-- A barber's public professional information is distinct from private Supabase Auth contact data.
-- Only the authenticated barber (or a trusted backend role) can change these fields.
BEGIN;
ALTER TABLE public.barbers
 ADD COLUMN IF NOT EXISTS specialties text[] NOT NULL DEFAULT ARRAY[]::text[],
 ADD COLUMN IF NOT EXISTS experience_years smallint NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS instagram_url text NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS professional_phone text NOT NULL DEFAULT '';
ALTER TABLE public.barbers
 DROP CONSTRAINT IF EXISTS barbers_experience_years_range;
ALTER TABLE public.barbers
 ADD CONSTRAINT barbers_experience_years_range CHECK(experience_years BETWEEN 0 AND 70);
ALTER TABLE public.barbers
 DROP CONSTRAINT IF EXISTS barbers_specialties_limit;
ALTER TABLE public.barbers
 ADD CONSTRAINT barbers_specialties_limit CHECK(cardinality(specialties)<=8);
ALTER TABLE public.barbers
 DROP CONSTRAINT IF EXISTS barbers_instagram_url_limit;
ALTER TABLE public.barbers
 ADD CONSTRAINT barbers_instagram_url_limit CHECK(length(instagram_url)<=160);
ALTER TABLE public.barbers
 DROP CONSTRAINT IF EXISTS barbers_professional_phone_limit;
ALTER TABLE public.barbers
 ADD CONSTRAINT barbers_professional_phone_limit CHECK(length(professional_phone)<=40);
COMMIT;
