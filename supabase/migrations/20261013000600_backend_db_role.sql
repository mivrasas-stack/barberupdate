-- Backend-specific database login, no credentials stored in source control.
BEGIN;
DO $block$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='barberos_backend') THEN
  CREATE ROLE barberos_backend NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 END IF;
END $block$;
GRANT CONNECT ON DATABASE postgres TO barberos_backend;
GRANT USAGE ON SCHEMA public TO barberos_backend;

GRANT SELECT,INSERT ON public.tenants,public.tenant_members,public.barbers,
  public.services,public.inventory_movements,public.transactions,public.media_assets,
  public.order_items,public.reviews,public.cash_closings TO barberos_backend;

GRANT SELECT,INSERT,UPDATE ON public.appointments,public.products,public.orders,
  public.outbox_events TO barberos_backend;

GRANT SELECT,INSERT,UPDATE ON public.tenants,public.tenant_members TO barberos_backend;
GRANT SELECT ON public.subscription_plans,public.tenant_subscriptions,
  public.loyalty_accounts,public.loyalty_events TO barberos_backend;

-- The API authenticates every request with Supabase Auth and scopes every
-- query by tenant. This DB role must never be exposed outside trusted servers.
-- These policies apply ONLY to the database login, not to anon/authenticated.
DO $policy$
DECLARE item text;
BEGIN
  FOREACH item IN ARRAY ARRAY[
    'tenants','tenant_members','barbers','services','appointments','products',
    'inventory_movements','transactions','media_assets','outbox_events',
    'orders','order_items','reviews','loyalty_accounts','loyalty_events',
    'cash_closings','subscription_plans','tenant_subscriptions'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY barberos_backend_access ON public.%I FOR ALL TO barberos_backend USING (true) WITH CHECK (true)',
      item
    );
  END LOOP;
END $policy$;
COMMIT;
