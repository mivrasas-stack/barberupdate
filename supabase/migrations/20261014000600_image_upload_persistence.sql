-- Migration: Add media persistence fields and allow barber/customer asset tracking
BEGIN;

-- 1. Tenants logo, cover and portfolio
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS logo_url text NOT NULL DEFAULT '' CHECK (length(logo_url) <= 2048),
  ADD COLUMN IF NOT EXISTS cover_url text NOT NULL DEFAULT '' CHECK (length(cover_url) <= 2048),
  ADD COLUMN IF NOT EXISTS portfolio text[] NOT NULL DEFAULT '{}';

-- 2. Barbers photo and portfolio
ALTER TABLE public.barbers
  ADD COLUMN IF NOT EXISTS photo_url text NOT NULL DEFAULT '' CHECK (length(photo_url) <= 2048),
  ADD COLUMN IF NOT EXISTS portfolio text[] NOT NULL DEFAULT '{}';

-- 3. Customer profiles avatar
ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS avatar_url text NOT NULL DEFAULT '' CHECK (length(avatar_url) <= 2048);

-- 4. Extend public.media_assets table to allow avatar kind and optional user_id linkage
ALTER TABLE public.media_assets
  DROP CONSTRAINT IF EXISTS media_assets_kind_check;

ALTER TABLE public.media_assets
  ADD CONSTRAINT media_assets_kind_check
  CHECK (kind IN ('logo', 'cover', 'portfolio', 'service', 'product', 'avatar'));

ALTER TABLE public.media_assets
  ALTER COLUMN tenant_id DROP NOT NULL;

-- 5. Grant permissions to barberos_backend
GRANT UPDATE ON public.barbers TO barberos_backend;
GRANT UPDATE ON public.tenants TO barberos_backend;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_assets TO barberos_backend;

COMMIT;
