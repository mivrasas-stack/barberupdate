-- Staff records a reason when an appointment is cancelled or a client fails to arrive.
-- Historical cancelled appointments are allowed to retain a NULL reason.
BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS cancellation_reason text;
DO $guard$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint WHERE conrelid='public.appointments'::regclass
    AND conname='appointments_cancellation_reason_valid'
 ) THEN
   ALTER TABLE public.appointments ADD CONSTRAINT appointments_cancellation_reason_valid
   CHECK (cancellation_reason IS NULL OR
     (status IN ('cancelled','no_show') AND char_length(trim(cancellation_reason)) BETWEEN 3 AND 250));
 END IF;
END $guard$;
COMMIT;
