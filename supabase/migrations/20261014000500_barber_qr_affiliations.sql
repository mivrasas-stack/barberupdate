-- Barber QR affiliations: each barber gets their own persistent QR link code,
-- and clients can link with either the barber, the barbershop, or both.
ALTER TABLE public.barbers
  ADD COLUMN IF NOT EXISTS link_code text NOT NULL DEFAULT upper(encode(extensions.gen_random_bytes(12),'hex'));
CREATE UNIQUE INDEX IF NOT EXISTS barbers_link_code_unique ON public.barbers(link_code);

ALTER TABLE public.customer_links
  ADD COLUMN IF NOT EXISTS link_scope text NOT NULL DEFAULT 'both' CHECK (link_scope IN ('both','barber','shop'));
