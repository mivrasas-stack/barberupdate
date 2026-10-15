-- Canonical WhatsApp queue bridge for mixed history.
-- Preserve legacy delivery rows, but retire its producer after the new
-- opt-in + verified-template message queue is installed.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '45s';

DO $bridge$
DECLARE pending_count bigint := 0;
BEGIN
  IF to_regclass('public.whatsapp_messages') IS NULL
    OR to_regclass('public.whatsapp_tenant_settings') IS NULL
    OR to_regclass('public.whatsapp_consents') IS NULL THEN
    RAISE EXCEPTION 'Install the approved-template WhatsApp migration before retiring the legacy trigger';
  END IF;

  IF to_regclass('public.whatsapp_deliveries') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.whatsapp_deliveries WHERE status = ''pending'''
      INTO pending_count;
    IF pending_count > 0 THEN
      RAISE EXCEPTION 'Legacy WhatsApp queue has % pending deliveries; reconcile and suppress first', pending_count;
    END IF;

    COMMENT ON TABLE public.whatsapp_deliveries IS
      'LEGACY READ-ONLY ARCHIVE after WhatsApp queue consolidation; do not send from this table. Approved templates use public.whatsapp_messages.';
  END IF;
END
$bridge$;

-- May have been installed by a separate Supabase migration. The new queue has
-- its own distinct appt_whatsapp_enqueue trigger; leave that one untouched.
DROP TRIGGER IF EXISTS appointments_whatsapp_queue ON public.appointments;

-- Ensure no tenant can send automatically just because a migration was applied.
UPDATE public.whatsapp_tenant_settings SET enabled = false WHERE enabled = true;
COMMIT;
