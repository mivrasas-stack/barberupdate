-- Phase 2: tenant-wide exceptional closed dates, checked at the database boundary.
BEGIN;
CREATE TABLE public.tenant_closed_days(
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  closed_date date NOT NULL,
  reason text NOT NULL DEFAULT '' CHECK (length(reason)<=250),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,closed_date)
);
ALTER TABLE public.tenant_closed_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY closed_days_member_read ON public.tenant_closed_days
  FOR SELECT TO authenticated USING(
    EXISTS(SELECT 1 FROM public.tenant_members m WHERE m.tenant_id=tenant_closed_days.tenant_id
      AND m.user_id=(SELECT auth.uid()))
  );
CREATE POLICY closed_days_backend ON public.tenant_closed_days FOR ALL TO barberos_backend
  USING(true) WITH CHECK(true);
REVOKE ALL ON public.tenant_closed_days FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.tenant_closed_days TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.tenant_closed_days TO barberos_backend;

CREATE OR REPLACE FUNCTION public.barberos_guard_closed_day_appointment()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE zone text; local_day date;
BEGIN
  IF NEW.status NOT IN ('pending','confirmed','waiting','in_service') THEN
    RETURN NEW;
  END IF;
  SELECT time_zone INTO zone FROM public.tenants WHERE id=NEW.tenant_id;
  IF zone IS NULL THEN
    RAISE EXCEPTION 'Business unavailable' USING ERRCODE='23514';
  END IF;
  local_day:=(NEW.starts_at AT TIME ZONE zone)::date;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||':closed:'||local_day::text,0));
  IF EXISTS(SELECT 1 FROM public.tenant_closed_days d
    WHERE d.tenant_id=NEW.tenant_id AND d.closed_date=local_day) THEN
    RAISE EXCEPTION 'Business is closed on requested date' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.barberos_guard_closed_day_appointment() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER appointments_closed_day_guard
  BEFORE INSERT OR UPDATE OF starts_at,ends_at,barber_id,status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.barberos_guard_closed_day_appointment();

CREATE OR REPLACE FUNCTION public.barberos_guard_tenant_closure()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE zone text;
BEGIN
  SELECT time_zone INTO zone FROM public.tenants WHERE id=NEW.tenant_id AND status='active';
  IF zone IS NULL THEN
    RAISE EXCEPTION 'Business unavailable' USING ERRCODE='23514';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text||':closed:'||NEW.closed_date::text,0));
  IF EXISTS(
    SELECT 1 FROM public.appointments a
    WHERE a.tenant_id=NEW.tenant_id
      AND (a.starts_at AT TIME ZONE zone)::date=NEW.closed_date
      AND a.status IN ('pending','confirmed','waiting','in_service')
  ) THEN
    RAISE EXCEPTION 'Rebook existing appointments before closing the day'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.barberos_guard_tenant_closure() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER tenant_closure_existing_bookings_guard
 BEFORE INSERT OR UPDATE OF closed_date,tenant_id ON public.tenant_closed_days
 FOR EACH ROW EXECUTE FUNCTION public.barberos_guard_tenant_closure();
COMMIT;