-- Phase 5: FK access path and bounded outbox retention permissions.
BEGIN;
CREATE INDEX IF NOT EXISTS idx_reviews_tenant_appointment
ON public.reviews(tenant_id,appointment_id);
GRANT DELETE ON public.outbox_events TO barberos_backend;
COMMIT;
