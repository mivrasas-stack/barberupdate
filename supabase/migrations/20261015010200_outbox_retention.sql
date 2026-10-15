-- Support bounded event retention without a full-table scan at high volume.
-- Backend worker deletes processed outbox events older than 30 days, 500 at a time.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '45s';
CREATE INDEX IF NOT EXISTS idx_outbox_processed_retention
  ON public.outbox_events (processed_at, id)
  WHERE processed_at IS NOT NULL;
COMMIT;
