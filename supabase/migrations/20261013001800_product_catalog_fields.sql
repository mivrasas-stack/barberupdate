-- Preserve every field of the original BarberOS boutique product form.
-- No design changes; backend persists the existing UI catalog metadata.
BEGIN;
ALTER TABLE public.products
 ADD COLUMN description text NOT NULL DEFAULT '' CHECK (length(description)<=2000),
 ADD COLUMN photo_url text NOT NULL DEFAULT '' CHECK (length(photo_url)<=2048),
 ADD COLUMN category text NOT NULL DEFAULT 'beauty'
   CHECK (category IN ('beauty','food_drinks','barbershop_merch')),
 ADD COLUMN cost_minor bigint NOT NULL DEFAULT 0 CHECK(cost_minor>=0),
 ADD COLUMN min_stock integer NOT NULL DEFAULT 0 CHECK(min_stock>=0),
 ADD COLUMN waiting_room_visible boolean NOT NULL DEFAULT true;
COMMIT;