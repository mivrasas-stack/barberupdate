-- Phase 1: immutable tenant ownership, consistent references and idempotency.
-- Idempotent only at the migration level: apply once to the dedicated BarberOS project.
BEGIN;
CREATE OR REPLACE FUNCTION public.barberos_guard_owner_membership()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE owner_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT t.owner_user_id INTO owner_id FROM public.tenants t WHERE t.id=OLD.tenant_id;
    IF owner_id = OLD.user_id THEN
      RAISE EXCEPTION 'Cannot delete tenant owner membership' USING ERRCODE='23514';
    END IF;
    RETURN OLD;
  END IF;
  SELECT t.owner_user_id INTO owner_id FROM public.tenants t WHERE t.id=NEW.tenant_id;
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Tenant missing' USING ERRCODE='23503';
  END IF;
  IF (NEW.role='owner') IS DISTINCT FROM (NEW.user_id=owner_id) THEN
    RAISE EXCEPTION 'Owner membership must match tenant owner' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND OLD.role='owner'
     AND (OLD.role,OLD.tenant_id,OLD.user_id) IS DISTINCT FROM (NEW.role,NEW.tenant_id,NEW.user_id) THEN
    RAISE EXCEPTION 'Tenant owner membership is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.barberos_guard_owner_membership() FROM PUBLIC;
DROP TRIGGER IF EXISTS tenant_members_owner_guard ON public.tenant_members;
CREATE TRIGGER tenant_members_owner_guard BEFORE INSERT OR UPDATE OR DELETE ON public.tenant_members
FOR EACH ROW EXECUTE FUNCTION public.barberos_guard_owner_membership();

CREATE OR REPLACE FUNCTION public.barberos_guard_tenant_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.owner_user_id IS DISTINCT FROM NEW.owner_user_id THEN
    RAISE EXCEPTION 'Owner transfer requires an explicit workflow' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.barberos_guard_tenant_owner() FROM PUBLIC;
DROP TRIGGER IF EXISTS tenants_owner_guard ON public.tenants;
CREATE TRIGGER tenants_owner_guard BEFORE UPDATE OF owner_user_id ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.barberos_guard_tenant_owner();

-- Cross-tenant reviews are rejected even when a server-side query is wrong.
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_tenant_id ON public.appointments(tenant_id,id);
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_appointment_tenant_fk
  FOREIGN KEY (tenant_id,appointment_id) REFERENCES public.appointments(tenant_id,id)
  ON DELETE CASCADE;

-- Keep completed daily closings unchangeable: journal entries only from current day.
CREATE OR REPLACE FUNCTION public.barberos_guard_closed_cash_day()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE tzone text;
BEGIN
  SELECT time_zone INTO tzone FROM public.tenants WHERE id=NEW.tenant_id;
  IF EXISTS (SELECT 1 FROM public.cash_closings
    WHERE tenant_id=NEW.tenant_id
      AND closing_date=(NEW.created_at AT TIME ZONE tzone)::date) THEN
    RAISE EXCEPTION 'This business day has already been closed'
    USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.barberos_guard_closed_cash_day() FROM PUBLIC;
DROP TRIGGER IF EXISTS transaction_closing_guard ON public.transactions;
CREATE TRIGGER transaction_closing_guard BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.barberos_guard_closed_cash_day();
COMMIT;
