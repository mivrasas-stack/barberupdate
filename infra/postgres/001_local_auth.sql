-- BarberNow-owned authentication. PostgreSQL 17. No Supabase services required.
-- Only run after the public schema is imported into the staging database.
BEGIN;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
ALTER TABLE auth.users ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS encrypted_password text;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_app_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS banned_until timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS barbernow_auth_email_unique ON auth.users(lower(email)) WHERE email IS NOT NULL;
CREATE TABLE IF NOT EXISTS auth.sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 access_token_hash bytea NOT NULL UNIQUE,
 refresh_token_hash bytea NOT NULL UNIQUE,
 access_expires_at timestamptz NOT NULL,
 refresh_expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 user_agent_hash text
);
CREATE INDEX IF NOT EXISTS barbernow_auth_sessions_owner ON auth.sessions(user_id,refresh_expires_at DESC);
CREATE INDEX IF NOT EXISTS barbernow_auth_sessions_unrevoked ON auth.sessions(refresh_expires_at) WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS auth.action_tokens (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 token_hash bytea NOT NULL UNIQUE,
 purpose text NOT NULL CHECK (purpose IN ('verify_email','recover_password','invite')),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS barbernow_auth_action_pending ON auth.action_tokens(user_id,purpose,expires_at) WHERE consumed_at IS NULL;
REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA auth FROM PUBLIC;
COMMIT;

[executed on device: vmi3669516 (22a9c8cd-8866-4186-9071-dab9301dff16)]