-- Transitional WhatsApp password recovery: OTP records stay on VPS PostgreSQL.
-- No recovery challenges are created in the legacy external database.
CREATE TABLE IF NOT EXISTS public.barbernow_password_recovery (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL,
 phone_e164 text NOT NULL CHECK(phone_e164 ~ '^[+]573[0-9]{9}$'),
 code_digest bytea NOT NULL,
 attempts smallint NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 expires_at timestamptz NOT NULL,
 reset_token_digest bytea UNIQUE,
 reset_expires_at timestamptz,
 provider_message_id text,
 consumed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS barbernow_recovery_user_active
 ON public.barbernow_password_recovery(user_id,created_at DESC)
 WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS barbernow_recovery_retention
 ON public.barbernow_password_recovery(created_at);
REVOKE ALL ON public.barbernow_password_recovery FROM PUBLIC;