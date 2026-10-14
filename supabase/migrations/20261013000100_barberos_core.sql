-- BarberOS initial multi-tenant schema for Supabase Postgres 15+.
-- Apply ONLY to a dedicated BarberOS Supabase project. Never apply to unrelated projects.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  owner_user_id uuid NOT NULL,
  currency text NOT NULL DEFAULT 'COP' CHECK (currency IN ('COP','USD','EUR')),
  time_zone text NOT NULL DEFAULT 'America/Bogota',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.tenant_members (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','manager','barber')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_members_user ON public.tenant_members(user_id,tenant_id);

CREATE TABLE IF NOT EXISTS public.barbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid,
  name text NOT NULL,
  slug text NOT NULL,
  bio text NOT NULL DEFAULT '',
  commission_rate numeric(5,4) NOT NULL DEFAULT 0 CHECK (commission_rate BETWEEN 0 AND 1),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,id),
  UNIQUE (tenant_id,slug)
);
CREATE INDEX IF NOT EXISTS idx_barbers_user ON public.barbers(user_id);
CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'haircut',
  duration_minutes integer NOT NULL CHECK(duration_minutes BETWEEN 5 AND 600),
  price_minor bigint NOT NULL CHECK(price_minor >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_services_tenant ON public.services(tenant_id,is_active);

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  barber_id uuid NOT NULL,
  service_id uuid NOT NULL,
  customer_user_id uuid,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  created_by uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  price_minor bigint NOT NULL CHECK(price_minor >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','waiting','in_service','completed','cancelled','no_show')),
  idempotency_key text NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appt_duration_positive CHECK (ends_at > starts_at),
  CONSTRAINT appt_barber_tenant_fk FOREIGN KEY(tenant_id,barber_id) REFERENCES public.barbers(tenant_id,id),
  CONSTRAINT appt_service_tenant_fk FOREIGN KEY(tenant_id,service_id) REFERENCES public.services(tenant_id,id),
  CONSTRAINT appt_idempotency UNIQUE(tenant_id,created_by,idempotency_key),
  CONSTRAINT appt_no_time_overlap EXCLUDE USING gist (
    tenant_id WITH =,
    barber_id WITH =,
    tstzrange(starts_at,ends_at,'[)') WITH &&
  ) WHERE (status IN ('pending','confirmed','waiting','in_service'))
);
CREATE INDEX IF NOT EXISTS idx_appt_tenant_schedule ON public.appointments(tenant_id,starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_appt_customer ON public.appointments(customer_user_id,starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_appt_barber_schedule ON public.appointments(barber_id,starts_at DESC);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sku text NOT NULL,
  name text NOT NULL,
  price_minor bigint NOT NULL CHECK(price_minor >= 0),
  stock integer NOT NULL DEFAULT 0 CHECK(stock >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,id),
  UNIQUE (tenant_id,sku)
);
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  delta integer NOT NULL CHECK(delta <> 0),
  reason text NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id,product_id) REFERENCES public.products(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_inventory_tenant_date ON public.inventory_movements(tenant_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type text NOT NULL CHECK(type IN ('income','expense')),
  category text NOT NULL,
  concept text NOT NULL,
  amount_minor bigint NOT NULL CHECK(amount_minor > 0),
  payment_method text NOT NULL CHECK(payment_method IN ('cash','debit','credit','transfer','nequi','daviplata','split')),
  reference_id uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_date ON public.transactions(tenant_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  storage_bucket text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp')),
  kind text NOT NULL CHECK(kind IN ('logo','cover','portfolio','service','product')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_media_tenant ON public.media_assets(tenant_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  topic text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 0,
  processed_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON public.outbox_events(next_attempt_at,created_at) WHERE processed_at IS NULL;

-- Trigger contains IDs/status only; never duplicate customer PII into Redis.
CREATE OR REPLACE FUNCTION public.barberos_appt_outbox() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  INSERT INTO public.outbox_events(tenant_id,topic,payload)
  VALUES (NEW.tenant_id,'appointment.changed',
    jsonb_build_object('appointmentId',NEW.id,'tenantId',NEW.tenant_id,'status',NEW.status,'updatedAt',NEW.updated_at));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS appointments_outbox ON public.appointments;
CREATE TRIGGER appointments_outbox AFTER INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.barberos_appt_outbox();

-- Explicit RLS on every business table; no cross-tenant Data API leakage.
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS member_own_select ON public.tenant_members;
CREATE POLICY member_own_select ON public.tenant_members FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS tenant_member_select ON public.tenants;
CREATE POLICY tenant_member_select ON public.tenants FOR SELECT TO authenticated USING
  (EXISTS (SELECT 1 FROM public.tenant_members m WHERE m.tenant_id=id AND m.user_id=(SELECT auth.uid())));
DROP POLICY IF EXISTS barber_member_select ON public.barbers;
CREATE POLICY barber_member_select ON public.barbers FOR SELECT TO authenticated USING
  (EXISTS (SELECT 1 FROM public.tenant_members m WHERE m.tenant_id=barbers.tenant_id AND m.user_id=(SELECT auth.uid())));
DROP POLICY IF EXISTS service_member_select ON public.services;
CREATE POLICY service_member_select ON public.services FOR SELECT TO authenticated USING
  (EXISTS (SELECT 1 FROM public.tenant_members m WHERE m.tenant_id=services.tenant_id AND m.user_id=(SELECT auth.uid())));
DROP POLICY IF EXISTS appt_member_or_customer_select ON public.appointments;
CREATE POLICY appt_member_or_customer_select ON public.appointments FOR SELECT TO authenticated USING
  (customer_user_id=(SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.tenant_members m WHERE m.tenant_id=appointments.tenant_id AND m.user_id=(SELECT auth.uid())));
DROP POLICY IF EXISTS product_member_select ON public.products;
CREATE POLICY product_member_select ON public.products FOR SELECT TO authenticated USING
  (EXISTS (SELECT 1 FROM public.tenant_members m WHERE m.tenant_id=products.tenant_id AND m.user_id=(SELECT auth.uid())));
DROP POLICY IF EXISTS inventory_owner_select ON public.inventory_movements;
CREATE POLICY inventory_owner_select ON public.inventory_movements FOR SELECT TO authenticated USING
  (EXISTS (SELECT 1 FROM public.tenant_members m WHERE m.tenant_id=inventory_movements.tenant_id AND m.user_id=(SELECT auth.uid()) AND m.role IN ('owner','manager')));
DROP POLICY IF EXISTS transaction_owner_select ON public.transactions;
CREATE POLICY transaction_owner_select ON public.transactions FOR SELECT TO authenticated USING
  (EXISTS (SELECT 1 FROM public.tenant_members m WHERE m.tenant_id=transactions.tenant_id AND m.user_id=(SELECT auth.uid()) AND m.role IN ('owner','manager')));
DROP POLICY IF EXISTS media_member_select ON public.media_assets;
CREATE POLICY media_member_select ON public.media_assets FOR SELECT TO authenticated USING
  (EXISTS (SELECT 1 FROM public.tenant_members m WHERE m.tenant_id=media_assets.tenant_id AND m.user_id=(SELECT auth.uid())));

-- Do not allow Data API direct writes; all mutations go through authorized backend.
REVOKE ALL ON public.tenants,public.tenant_members,public.barbers,public.services,public.appointments,
  public.products,public.inventory_movements,public.transactions,public.media_assets,public.outbox_events FROM anon,authenticated;
GRANT SELECT ON public.tenants,public.tenant_members,public.barbers,public.services,public.appointments,
  public.products,public.inventory_movements,public.transactions,public.media_assets TO authenticated;

-- Supabase Realtime: RLS applies to authorized subscribers.
DO $do$
BEGIN
  IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime')
    AND NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='appointments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
  END IF;
END $do$;
COMMIT;
