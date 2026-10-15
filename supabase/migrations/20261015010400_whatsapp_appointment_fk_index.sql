-- Covers the standalone appointment FK while preserving the tenant-first lookup index.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '45s';
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_appointment_fk
 ON public.whatsapp_messages (appointment_id);
COMMIT;
