-- Phase 2: governed barber availability, holidays and idempotency payloads.
BEGIN;
CREATE TABLE public.barber_work_intervals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  barber_id uuid NOT NULL,
  weekday integer NOT NULL CHECK(weekday BETWEEN 0 AND 6),
  start_minute integer NOT NULL CHECK(start_minute BETWEEN 0 AND 1439),
  end_minute integer NOT NULL CHECK(end_minute BETWEEN 1 AND 1440),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (start_minute < end_minute),
  FOREIGN KEY(tenant_id,barber_id) REFERENCES public.barbers(tenant_id,id) ON DELETE CASCADE,
  UNIQUE(tenant_id,barber_id,weekday,start_minute)
);
CREATE INDEX idx_work_intervals_tenant_barber ON public.barber_work_intervals(tenant_id,barber_id,weekday);

CREATE TABLE public.barber_time_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  barber_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text NOT NULL DEFAULT '' CHECK(length(reason)<=250),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(ends_at>starts_at),
  FOREIGN KEY(tenant_id,barber_id) REFERENCES public.barbers(tenant_id,id) ON DELETE CASCADE
);
CREATE INDEX idx_time_off_window ON public.barber_time_off(tenant_id,barber_id,starts_at,ends_at);

ALTER TABLE public.barber_work_intervals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_time_off ENABLE ROW LEVEL SECURITY;
CREATE POLICY work_intervals_employee_read ON public.barber_work_intervals
FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.tenant_members m WHERE m.tenant_id=barber_work_intervals.tenant_id
 AND m.user_id=(SELECT auth.uid()))
);
CREATE POLICY time_off_employee_read ON public.barber_time_off
FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.tenant_members m WHERE m.tenant_id=barber_time_off.tenant_id
 AND m.user_id=(SELECT auth.uid()))
);
REVOKE ALL ON public.barber_work_intervals,public.barber_time_off FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.barber_work_intervals,public.barber_time_off TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.barber_work_intervals,public.barber_time_off TO barberos_backend;
CREATE POLICY work_intervals_backend ON public.barber_work_intervals FOR ALL TO barberos_backend USING(true) WITH CHECK(true);
CREATE POLICY time_off_backend ON public.barber_time_off FOR ALL TO barberos_backend USING(true) WITH CHECK(true);

ALTER TABLE public.appointments ADD COLUMN request_hash text;
ALTER TABLE public.orders ADD COLUMN request_hash text;
ALTER TABLE public.appointments ADD CONSTRAINT appt_request_hash_valid CHECK(request_hash IS NULL OR request_hash ~ '^[a-f0-9]{64}$');
ALTER TABLE public.orders ADD CONSTRAINT order_request_hash_valid CHECK(request_hash IS NULL OR request_hash ~ '^[a-f0-9]{64}$');

CREATE OR REPLACE FUNCTION public.barberos_validate_timezone()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=NEW.time_zone) THEN
   RAISE EXCEPTION 'Invalid IANA timezone' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.barberos_validate_timezone() FROM PUBLIC;
CREATE TRIGGER tenants_validate_timezone BEFORE INSERT OR UPDATE OF time_zone ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.barberos_validate_timezone();

CREATE OR REPLACE FUNCTION public.barberos_check_working_hours()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE tz text;
DECLARE start_local timestamp;
DECLARE end_local timestamp;
DECLARE start_m integer;
DECLARE end_m integer;
DECLARE dow integer;
BEGIN
 IF NEW.status NOT IN ('pending','confirmed','waiting','in_service') THEN
   RETURN NEW;
 END IF;
 SELECT time_zone INTO tz FROM public.tenants WHERE id=NEW.tenant_id AND status='active';
 IF tz IS NULL THEN RAISE EXCEPTION 'Inactive or missing tenant' USING ERRCODE='23514'; END IF;
 start_local:=NEW.starts_at AT TIME ZONE tz;
 end_local:=NEW.ends_at AT TIME ZONE tz;
 IF start_local::date <> end_local::date
    OR EXTRACT(SECOND FROM start_local)<>0
    OR EXTRACT(SECOND FROM end_local)<>0
    OR EXTRACT(MICROSECONDS FROM start_local)::int % 1000000 <> 0
    OR EXTRACT(MICROSECONDS FROM end_local)::int % 1000000 <> 0 THEN
   RAISE EXCEPTION 'Appointment must fit within a local calendar day and align to minutes' USING ERRCODE='23514';
 END IF;
 dow:=EXTRACT(DOW FROM start_local)::integer;
 start_m:=EXTRACT(HOUR FROM start_local)::integer*60+EXTRACT(MINUTE FROM start_local)::integer;
 end_m:=EXTRACT(HOUR FROM end_local)::integer*60+EXTRACT(MINUTE FROM end_local)::integer;
 IF NOT EXISTS(
   SELECT 1 FROM public.barber_work_intervals w
   WHERE w.tenant_id=NEW.tenant_id AND w.barber_id=NEW.barber_id AND w.weekday=dow
     AND start_m>=w.start_minute AND end_m<=w.end_minute
 ) THEN RAISE EXCEPTION 'Barber has no availability in requested window' USING ERRCODE='23514'; END IF;
 IF EXISTS(
   SELECT 1 FROM public.barber_time_off o
   WHERE o.tenant_id=NEW.tenant_id AND o.barber_id=NEW.barber_id
     AND o.starts_at<NEW.ends_at AND o.ends_at>NEW.starts_at
 ) THEN RAISE EXCEPTION 'Barber is unavailable in requested window' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.barberos_check_working_hours() FROM PUBLIC;
CREATE TRIGGER appt_working_hours_guard
BEFORE INSERT OR UPDATE OF starts_at,ends_at,barber_id,status ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.barberos_check_working_hours();
COMMIT;
