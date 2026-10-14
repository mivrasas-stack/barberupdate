CREATE TABLE IF NOT EXISTS public.barber_invites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 code_hash text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS barber_invites_tenant_idx ON public.barber_invites(tenant_id);
CREATE TABLE IF NOT EXISTS public.barber_join_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 full_name text NOT NULL CHECK (length(btrim(full_name)) BETWEEN 2 AND 120),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz,
 UNIQUE(tenant_id,user_id)
);
CREATE INDEX IF NOT EXISTS barber_join_requests_tenant_status_idx ON public.barber_join_requests(tenant_id,status);
ALTER TABLE public.barber_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_join_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.barber_invites,public.barber_join_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.barber_invites,public.barber_join_requests TO barberos_backend;
CREATE POLICY backend_barber_invites ON public.barber_invites FOR ALL TO barberos_backend USING(true) WITH CHECK(true);
CREATE POLICY backend_barber_requests ON public.barber_join_requests FOR ALL TO barberos_backend USING(true) WITH CHECK(true);
