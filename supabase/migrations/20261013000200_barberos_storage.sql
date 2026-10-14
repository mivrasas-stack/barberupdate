-- Supabase Storage public images + Smart CDN. Apply only to dedicated BarberOS project.
BEGIN;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('barberos-images','barberos-images',true,10485760,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET file_size_limit=EXCLUDED.file_size_limit,
allowed_mime_types=EXCLUDED.allowed_mime_types;
-- Do not grant direct upload to anon/authenticated. Backend issues signed URLs.
COMMIT;
