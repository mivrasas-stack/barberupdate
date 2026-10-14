-- Run against isolated disposable PostgreSQL 16+ ONLY.
INSERT INTO public.tenants(id,slug,name,owner_user_id) VALUES
('11111111-1111-4111-8111-111111111111','test-tenant-one','Tenant One','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('22222222-2222-4222-8222-222222222222','test-tenant-two','Tenant Two','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
INSERT INTO public.tenant_members(tenant_id,user_id,role) VALUES
('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','owner'),
('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','owner');
INSERT INTO public.barbers(id,tenant_id,slug,name) VALUES
('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','barber-one','Barber 1'),
('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','barber-two','Barber 2');
INSERT INTO public.services(id,tenant_id,name,duration_minutes,price_minor) VALUES
('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','Haircut',30,25000),
('66666666-6666-4666-8666-666666666666','22222222-2222-4222-8222-222222222222','Beard',30,18000);
INSERT INTO public.appointments(tenant_id,barber_id,service_id,customer_user_id,customer_name,customer_phone,created_by,starts_at,ends_at,price_minor,idempotency_key)
VALUES('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','55555555-5555-4555-8555-555555555555',
'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Test client','+573000000000','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
'2030-01-01T10:00:00Z','2030-01-01T10:30:00Z',25000,'validation-unique-1');
DO $$
BEGIN
  BEGIN
    INSERT INTO public.appointments(tenant_id,barber_id,service_id,customer_name,customer_phone,created_by,starts_at,ends_at,price_minor,idempotency_key)
    VALUES('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','55555555-5555-4555-8555-555555555555',
    'Clash','+573000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2030-01-01T10:15:00Z','2030-01-01T10:45:00Z',25000,'validation-clash-2');
    RAISE EXCEPTION 'BUG: overlapping reservation was accepted';
  EXCEPTION WHEN exclusion_violation THEN
    RAISE NOTICE 'PASS: overlapping appointment rejected by Postgres exclusion constraint';
  END;
  BEGIN
    INSERT INTO public.appointments(tenant_id,barber_id,service_id,customer_name,customer_phone,created_by,starts_at,ends_at,price_minor,idempotency_key)
    VALUES('11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555',
    'Wrong tenant','+573000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2030-01-01T11:00:00Z','2030-01-01T11:30:00Z',25000,'validation-wrong-tenant');
    RAISE EXCEPTION 'BUG: cross-tenant barber reference was accepted';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'PASS: cross-tenant barber rejected by composite foreign key';
  END;
END $$;
-- Verify row security while impersonating the Supabase authenticated role.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
DO $$
BEGIN
  IF (SELECT count(*) FROM public.appointments) <> 0 THEN
    RAISE EXCEPTION 'BUG: tenant 2 can read tenant 1 appointments';
  END IF;
  RAISE NOTICE 'PASS: tenant data isolated by RLS';
END $$;
RESET ROLE;
