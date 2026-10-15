-- Preserve operational transactions and add optional, bounded audit notes.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '45s';
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';
DO $m$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.transactions'::regclass
                 AND conname='transactions_notes_length_check') THEN
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_notes_length_check
      CHECK (char_length(notes) <= 1000);
  END IF;
END
$m$;
COMMIT;
