-- Planned blocks of NEW bookings only. Does not cancel or alter existing appointments.
BEGIN;
CREATE TABLE IF NOT EXISTS public.tenant_booking_blackouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text NOT NULL DEFAULT '' CHECK (length(reason)<=250),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_booking_blackout_dates CHECK(end_date>=start_date AND end_date<=start_date+366)
);
CREATE INDEX IF NOT EXISTS idx_booking_blackouts_dates
  ON public.tenant_booking_blackouts (tenant_id,start_date,end_date);
ALTER TABLE public.tenant_booking_blackouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tenant_booking_blackouts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.tenant_booking_blackouts TO barberos_backend;
CREATE POLICY tenant_booking_blackout_backend ON public.tenant_booking_blackouts
  FOR ALL TO barberos_backend USING(true) WITH CHECK(true);
COMMIT;