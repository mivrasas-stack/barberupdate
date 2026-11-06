-- BarberNow self-hosted WhatsApp verification for signup, ownership and recovery.
-- User IDs remain unchanged; legacy users are NOT automatically marked phone-verified.
BEGIN;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS phone_e164 text;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS barbernow_auth_unique_verified_phone
 ON auth.users(phone_e164) WHERE phone_verified_at IS NOT NULL AND phone_e164 IS NOT NULL;
CREATE TABLE IF NOT EXISTS auth.whatsapp_challenges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 phone_e164 text NOT NULL,
 purpose text NOT NULL CHECK (purpose IN ('signup','recovery','link')),
 otp_digest bytea NOT NULL,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 provider_message_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(phone_e164 ~ '^[+]573[0-9]{9}$')
);
CREATE INDEX IF NOT EXISTS barbernow_auth_whatsapp_pending ON auth.whatsapp_challenges(user_id,created_at DESC) WHERE consumed_at IS NULL;
REVOKE ALL ON auth.whatsapp_challenges FROM PUBLIC;
COMMIT;

[executed on device: vmi3669516 (22a9c8cd-8866-4186-9071-dab9301dff16)]