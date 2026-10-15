-- Platform-only integration vault. Secrets are encrypted with the backend-only
-- PLATFORM_SECRETS_KEY before insertion; the database never stores API keys in plaintext.
BEGIN;
CREATE TABLE public.platform_integrations(
  provider text PRIMARY KEY CHECK (provider IN ('whatsapp','email','openai')),
  enabled boolean NOT NULL DEFAULT false,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(settings)='object'),
  secrets jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(secrets)='object'),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_integrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_integrations FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.platform_integrations TO barberos_backend;
CREATE POLICY platform_integrations_backend ON public.platform_integrations FOR ALL
  TO barberos_backend USING(true) WITH CHECK(true);
COMMIT;
