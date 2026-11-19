-- Owner-operated BarberNow PostgreSQL only.
-- An administrator must verify actual possession of a registered WhatsApp
-- number before allowing recovery of an account sharing that number.
CREATE TABLE IF NOT EXISTS public.barbernow_verified_auth_phones (
 user_id uuid PRIMARY KEY,
 phone_e164 text NOT NULL UNIQUE CHECK (phone_e164 ~ '^[+]573[0-9]{9}$'),
 verified_at timestamptz NOT NULL DEFAULT now(),
 verified_by uuid NOT NULL
);
CREATE TABLE IF NOT EXISTS public.barbernow_phone_verification (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL,
 phone_e164 text NOT NULL CHECK (phone_e164 ~ '^[+]573[0-9]{9}$'),
 code_digest bytea NOT NULL,
 attempts smallint NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 provider_message_id text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS barbernow_phone_verification_pending
 ON public.barbernow_phone_verification(user_id,created_at DESC)
 WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS barbernow_phone_verification_retention
 ON public.barbernow_phone_verification(created_at);
REVOKE ALL ON public.barbernow_verified_auth_phones FROM PUBLIC;
REVOKE ALL ON public.barbernow_phone_verification FROM PUBLIC;