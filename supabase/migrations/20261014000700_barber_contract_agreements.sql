-- Migration: Add barber contract agreement fields (contract_type, chair_rental_fee, chair_rental_period)
BEGIN;

ALTER TABLE public.barbers
  ADD COLUMN IF NOT EXISTS contract_type text NOT NULL DEFAULT 'commission' 
    CHECK (contract_type IN ('commission', 'chair_rental', 'hybrid')),
  ADD COLUMN IF NOT EXISTS chair_rental_fee numeric(12,2) NOT NULL DEFAULT 0 
    CHECK (chair_rental_fee >= 0),
  ADD COLUMN IF NOT EXISTS chair_rental_period text NOT NULL DEFAULT 'monthly' 
    CHECK (chair_rental_period IN ('daily', 'weekly', 'biweekly', 'monthly'));

-- Ensure permissions
GRANT UPDATE ON public.barbers TO barberos_backend;

COMMIT;
