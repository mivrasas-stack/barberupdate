-- Additive change: shared booking groups and a temporary pause that preserves weekly hours.
BEGIN;
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS accepting_bookings boolean NOT NULL DEFAULT true;
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS booking_group_id uuid;
CREATE INDEX IF NOT EXISTS idx_appointments_booking_group
  ON public.appointments(tenant_id,booking_group_id)
  WHERE booking_group_id IS NOT NULL;
COMMIT;