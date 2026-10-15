-- Barber Paradise: scaling foundation (non-destructive, rerunnable).
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '45s';

-- Missing indexes identified in the real Supabase performance advisor.
CREATE INDEX IF NOT EXISTS idx_barber_join_requests_user_id
 ON public.barber_join_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_links_tenant_barber
 ON public.customer_links (tenant_id, barber_id);

-- Exact filter and claim order used by SKIP LOCKED event workers.
CREATE INDEX IF NOT EXISTS idx_outbox_ready_claim
 ON public.outbox_events (next_attempt_at, id)
 WHERE processed_at IS NULL AND attempts < 12;

-- The remote legacy WhatsApp table is not yet represented in all Git branches.
DO $body$
BEGIN
 IF to_regclass('public.whatsapp_deliveries') IS NOT NULL THEN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_whatsapp_deliveries_tenant_due ON public.whatsapp_deliveries (tenant_id, due_at DESC)';
 END IF;
END $body$;
COMMIT;
