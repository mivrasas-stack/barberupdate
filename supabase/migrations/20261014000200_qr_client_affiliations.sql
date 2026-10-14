-- QR enrollment: distinct persistent invitation codes and opt-in client affiliations.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS link_code text NOT NULL DEFAULT upper(encode(extensions.gen_random_bytes(12),'hex'));
CREATE UNIQUE INDEX IF NOT EXISTS tenants_link_code_unique ON public.tenants(link_code);
CREATE TABLE IF NOT EXISTS public.customer_profiles (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 full_name text NOT NULL CHECK (length(btrim(full_name)) BETWEEN 2 AND 120),
 phone text NOT NULL CHECK (length(btrim(phone)) BETWEEN 7 AND 32),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.customer_links (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
 barber_id uuid,
 linked_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (user_id,tenant_id),
 CONSTRAINT linked_barber_same_tenant FOREIGN KEY(tenant_id,barber_id)
  REFERENCES public.barbers(tenant_id,id) ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS customer_links_tenant_idx ON public.customer_links(tenant_id);
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_profiles,public.customer_links FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.customer_profiles,public.customer_links TO barberos_backend;
CREATE POLICY backend_customer_profiles ON public.customer_profiles FOR ALL TO barberos_backend USING(true) WITH CHECK(true);
CREATE POLICY backend_customer_links ON public.customer_links FOR ALL TO barberos_backend USING(true) WITH CHECK(true);
GRANT SELECT ON public.customer_profiles,public.customer_links TO authenticated;
CREATE POLICY own_customer_profile ON public.customer_profiles FOR SELECT TO authenticated USING(user_id=(select auth.uid()));
CREATE POLICY own_customer_links ON public.customer_links FOR SELECT TO authenticated USING(user_id=(select auth.uid()));
