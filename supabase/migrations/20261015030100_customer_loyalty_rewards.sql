-- Real customer loyalty: tenant-scoped reward catalog, redemption ledger, and opt-in service points.
BEGIN;

ALTER TABLE public.services
 ADD COLUMN IF NOT EXISTS earns_loyalty_points boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 3 AND 120),
 description text NOT NULL DEFAULT '' CHECK(length(description)<=500),
 points_cost integer NOT NULL CHECK(points_cost BETWEEN 1 AND 1000000),
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_active ON public.loyalty_rewards(tenant_id,is_active);

CREATE TABLE IF NOT EXISTS public.loyalty_redemptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 user_id uuid NOT NULL,
 reward_id uuid NOT NULL,
 points_cost integer NOT NULL CHECK(points_cost>0),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','fulfilled','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(),
 fulfilled_at timestamptz,
 FOREIGN KEY(tenant_id,reward_id) REFERENCES public.loyalty_rewards(tenant_id,id),
 FOREIGN KEY(tenant_id,user_id) REFERENCES public.loyalty_accounts(tenant_id,user_id),
 UNIQUE(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_loyalty_redemptions_user ON public.loyalty_redemptions(user_id,created_at DESC);

ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;
-- No direct writes from a browser; all mutations are validated by Fastify.
CREATE POLICY loyalty_rewards_member_read ON public.loyalty_rewards FOR SELECT TO authenticated
 USING(is_active OR EXISTS(SELECT 1 FROM public.tenant_members m
 WHERE m.tenant_id=loyalty_rewards.tenant_id AND m.user_id=(SELECT auth.uid())
 AND m.role IN ('owner','manager')));
CREATE POLICY loyalty_rewards_backend ON public.loyalty_rewards FOR ALL TO barberos_backend USING(true) WITH CHECK(true);
CREATE POLICY loyalty_redemptions_self_read ON public.loyalty_redemptions FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()) OR EXISTS(SELECT 1 FROM public.tenant_members m
 WHERE m.tenant_id=loyalty_redemptions.tenant_id AND m.user_id=(SELECT auth.uid())
 AND m.role IN ('owner','manager')));
CREATE POLICY loyalty_redemptions_backend ON public.loyalty_redemptions FOR ALL TO barberos_backend USING(true) WITH CHECK(true);
REVOKE ALL ON public.loyalty_rewards,public.loyalty_redemptions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.loyalty_rewards,public.loyalty_redemptions TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.loyalty_rewards,public.loyalty_redemptions TO barberos_backend;
GRANT INSERT ON public.loyalty_events,public.loyalty_accounts TO barberos_backend;
GRANT UPDATE(points,visits_count,updated_at) ON public.loyalty_accounts TO barberos_backend;

-- Only opted-in completed services earn one point for each COP 1,000.
-- Non-eligible appointments still count as a visit, but never receive fabricated points.
CREATE OR REPLACE FUNCTION public.barberos_record_loyalty()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE points_earned integer;
BEGIN
 IF NEW.status='completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.customer_user_id IS NOT NULL THEN
  INSERT INTO public.loyalty_accounts(tenant_id,user_id,points,visits_count)
   VALUES(NEW.tenant_id,NEW.customer_user_id,0,0) ON CONFLICT DO NOTHING;
  -- Same appointment may only be completed once for loyalty purposes.
  SELECT CASE WHEN s.earns_loyalty_points THEN LEAST(1000000,GREATEST(0,FLOOR(NEW.price_minor/1000.0)::integer))
              ELSE 0 END
   INTO points_earned FROM public.services s WHERE s.tenant_id=NEW.tenant_id AND s.id=NEW.service_id;
  IF COALESCE(points_earned,0)>0 THEN
   INSERT INTO public.loyalty_events(tenant_id,user_id,appointment_id,points_delta,description)
    VALUES(NEW.tenant_id,NEW.customer_user_id,NEW.id,points_earned,'Servicio completado')
    ON CONFLICT(tenant_id,appointment_id) DO NOTHING;
   IF FOUND THEN
    UPDATE public.loyalty_accounts SET points=points+points_earned,visits_count=visits_count+1,updated_at=now()
     WHERE tenant_id=NEW.tenant_id AND user_id=NEW.customer_user_id;
   END IF;
  ELSE
   UPDATE public.loyalty_accounts SET visits_count=visits_count+1,updated_at=now()
    WHERE tenant_id=NEW.tenant_id AND user_id=NEW.customer_user_id;
  END IF;
 END IF;
 RETURN NEW;
END;$$;

COMMIT;
