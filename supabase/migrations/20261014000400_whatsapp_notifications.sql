-- Outgoing Meta template messages; secrets never stored in PostgreSQL.
BEGIN;
ALTER TABLE public.appointments ADD COLUMN whatsapp_opt_in boolean NOT NULL DEFAULT false;
ALTER TABLE public.barbers ADD COLUMN whatsapp_phone text;
ALTER TABLE public.barbers ADD COLUMN whatsapp_opt_in boolean NOT NULL DEFAULT false;
CREATE TABLE public.whatsapp_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('confirmation','barber_new','cancellation','reminder')),
 due_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed','skipped')),
 attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 last_error text,
 meta_message_id text,
 sent_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(appointment_id,kind)
);
CREATE INDEX idx_whatsapp_due ON public.whatsapp_deliveries(next_attempt_at,due_at) WHERE status='pending';
ALTER TABLE public.whatsapp_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY whatsapp_backend_access ON public.whatsapp_deliveries FOR ALL TO barberos_backend USING(true) WITH CHECK(true);
REVOKE ALL ON public.whatsapp_deliveries FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.whatsapp_deliveries TO barberos_backend;
GRANT UPDATE(whatsapp_opt_in) ON public.appointments TO barberos_backend;
GRANT SELECT,UPDATE(whatsapp_phone,whatsapp_opt_in) ON public.barbers TO barberos_backend;
CREATE OR REPLACE FUNCTION public.barberos_whatsapp_enqueue() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE should_notify boolean;
BEGIN
 IF TG_OP='INSERT' THEN
   IF NEW.whatsapp_opt_in THEN
     INSERT INTO public.whatsapp_deliveries(tenant_id,appointment_id,kind)
     VALUES(NEW.tenant_id,NEW.id,'confirmation') ON CONFLICT DO NOTHING;
     IF NEW.starts_at>now()+interval '1 hour' THEN
       INSERT INTO public.whatsapp_deliveries(tenant_id,appointment_id,kind,due_at,next_attempt_at)
       VALUES(NEW.tenant_id,NEW.id,'reminder',NEW.starts_at-interval '1 hour',NEW.starts_at-interval '1 hour')
       ON CONFLICT DO NOTHING;
     END IF;
   END IF;
   SELECT b.whatsapp_opt_in AND b.whatsapp_phone IS NOT NULL INTO should_notify
   FROM public.barbers b WHERE b.id=NEW.barber_id AND b.tenant_id=NEW.tenant_id;
   IF should_notify THEN
     INSERT INTO public.whatsapp_deliveries(tenant_id,appointment_id,kind)
     VALUES(NEW.tenant_id,NEW.id,'barber_new') ON CONFLICT DO NOTHING;
   END IF;
 ELSE
   IF NEW.status IN ('cancelled','no_show') AND OLD.status IS DISTINCT FROM NEW.status THEN
     UPDATE public.whatsapp_deliveries SET status='skipped'
       WHERE appointment_id=NEW.id AND kind='reminder' AND status='pending';
     -- This template explicitly says no-show, so it is only correct for no_show.
     IF NEW.status='no_show' AND NEW.whatsapp_opt_in THEN
       INSERT INTO public.whatsapp_deliveries(tenant_id,appointment_id,kind)
       VALUES(NEW.tenant_id,NEW.id,'cancellation') ON CONFLICT DO NOTHING;
     END IF;
   END IF;
   IF NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.barber_id IS DISTINCT FROM OLD.barber_id THEN
     IF NEW.whatsapp_opt_in AND NEW.status IN ('pending','confirmed')
       AND NEW.starts_at>now()+interval '1 hour' THEN
       INSERT INTO public.whatsapp_deliveries(tenant_id,appointment_id,kind,due_at,next_attempt_at)
       VALUES(NEW.tenant_id,NEW.id,'reminder',NEW.starts_at-interval '1 hour',NEW.starts_at-interval '1 hour')
       ON CONFLICT(appointment_id,kind) DO UPDATE
       SET due_at=EXCLUDED.due_at,next_attempt_at=EXCLUDED.next_attempt_at,status='pending',attempts=0,last_error=NULL
       WHERE public.whatsapp_deliveries.status IN ('pending','skipped');
     ELSE
       UPDATE public.whatsapp_deliveries SET status='skipped'
       WHERE appointment_id=NEW.id AND kind='reminder' AND status='pending';
     END IF;
   END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.barberos_whatsapp_enqueue() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER appointments_whatsapp_queue AFTER INSERT OR UPDATE OF status,starts_at,barber_id ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.barberos_whatsapp_enqueue();
COMMIT;
