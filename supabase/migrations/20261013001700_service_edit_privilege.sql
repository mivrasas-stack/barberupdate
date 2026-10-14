-- BarberOS frontend integration: allow limited API role to edit only public catalog service fields.
-- Authorization is still enforced in Fastify by tenant membership and owner/manager roles.
BEGIN;
GRANT UPDATE(name,description,price_minor,duration_minutes,category)
  ON TABLE public.services TO barberos_backend;
COMMIT;