-- Explicit privileged test/admin identity; never trust user-provided JWT metadata.
-- Independent professional owns a tenant but is distinguished in auth-facing UI.
BEGIN;
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS business_kind text NOT NULL DEFAULT 'barbershop'
  CHECK (business_kind IN ('barbershop','independent'));
CREATE TABLE IF NOT EXISTS public.platform_admins(
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_admins FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.platform_admins TO barberos_backend;
DROP POLICY IF EXISTS backend_read_platform_admins ON public.platform_admins;
CREATE POLICY backend_read_platform_admins ON public.platform_admins
  FOR SELECT TO barberos_backend USING (true);
COMMIT;