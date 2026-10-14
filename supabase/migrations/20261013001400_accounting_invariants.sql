-- Enforce accounting invariants in PostgreSQL as defense in depth.
-- Wompi remains unrelated: it will only be used for future BarberOS SaaS subscriptions.
BEGIN;
CREATE OR REPLACE FUNCTION public.barberos_guard_manual_refund()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE source record;
DECLARE already_refunded bigint;
BEGIN
  SELECT tenant_id,order_id,amount_minor,currency,method,status
    INTO source FROM public.manual_payments
    WHERE id=NEW.payment_id AND tenant_id=NEW.tenant_id FOR UPDATE;
  IF NOT FOUND OR source.status<>'confirmed'
     OR source.order_id<>NEW.order_id OR source.currency<>NEW.currency
     OR source.method<>NEW.method THEN
    RAISE EXCEPTION 'Refund must match a confirmed payment'
      USING ERRCODE='23514';
  END IF;
  IF source.method<>'cash' AND NEW.reference IS NULL THEN
    RAISE EXCEPTION 'Non-cash refunds require a receipt'
      USING ERRCODE='23514';
  END IF;
  SELECT coalesce(sum(amount_minor),0)::bigint INTO already_refunded
    FROM public.manual_refunds
    WHERE tenant_id=NEW.tenant_id AND payment_id=NEW.payment_id;
  IF already_refunded+NEW.amount_minor>source.amount_minor THEN
    RAISE EXCEPTION 'Refund exceeds confirmed payment'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.barberos_guard_manual_refund() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER manual_refunds_payment_guard
BEFORE INSERT ON public.manual_refunds
FOR EACH ROW EXECUTE FUNCTION public.barberos_guard_manual_refund();

CREATE OR REPLACE FUNCTION public.barberos_guard_manual_payment_edit()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF (NEW.tenant_id,NEW.order_id,NEW.amount_minor,NEW.currency,NEW.method,
      NEW.idempotency_key,NEW.request_hash,NEW.created_by,NEW.created_at)
     IS DISTINCT FROM
     (OLD.tenant_id,OLD.order_id,OLD.amount_minor,OLD.currency,OLD.method,
      OLD.idempotency_key,OLD.request_hash,OLD.created_by,OLD.created_at) THEN
    RAISE EXCEPTION 'Manual payment identity and amount are immutable'
      USING ERRCODE='23514';
  END IF;
  IF OLD.status IN ('confirmed','voided') AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Confirmed or voided manual payment is immutable'
      USING ERRCODE='23514';
  END IF;
  IF OLD.status='pending' AND NEW.status NOT IN ('pending','confirmed','voided') THEN
    RAISE EXCEPTION 'Invalid manual payment state transition'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.barberos_guard_manual_payment_edit() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER manual_payments_immutable_guard
BEFORE UPDATE ON public.manual_payments
FOR EACH ROW EXECUTE FUNCTION public.barberos_guard_manual_payment_edit();
COMMIT;