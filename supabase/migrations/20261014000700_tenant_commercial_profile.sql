-- Migration: Add commercial profile, contact, location and operational hours to tenants
BEGIN;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS tagline text NOT NULL DEFAULT '' CHECK (length(tagline) <= 250),
  ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '' CHECK (length(address) <= 300),
  ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT '' CHECK (length(city) <= 120),
  ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '' CHECK (length(phone) <= 40),
  ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '' CHECK (length(email) <= 150),
  ADD COLUMN IF NOT EXISTS latitude numeric(9,6),
  ADD COLUMN IF NOT EXISTS longitude numeric(9,6),
  ADD COLUMN IF NOT EXISTS opening_hours jsonb NOT NULL DEFAULT '{"days":"Lunes a Sábado","open":"09:00","close":"20:00"}'::jsonb,
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
