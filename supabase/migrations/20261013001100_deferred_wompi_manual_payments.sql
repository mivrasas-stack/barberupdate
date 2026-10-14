-- BarberOS deferred Wompi design: trustworthy manual-payment ledger only.
-- There is NO Wompi checkout or online payment processing in this release.
BEGIN;
CREATE TABLE public.manual_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 order_id uuid NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 1000000000000),
 currency text NOT NULL CHECK(currency IN ('COP','USD','EUR')),
 method text NOT NULL CHECK(method IN ('cash','transfer','debit','credit','nequi','daviplata')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','voided')),
 idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 12 AND 100),
 request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 reference text CHECK(reference IS NULL OR length(reference) BETWEEN 3 AND 120),
 created_by uuid NOT NULL,
 confirmed_by uuid,
 confirmed_at timestamptz,
 voided_by uuid,
 voided_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,order_id) REFERENCES public.orders(tenant_id,id) ON DELETE CASCADE,
 UNIQUE(tenant_id,created_by,idempotency_key),
 CONSTRAINT manual_payment_state CHECK (
  (status='pending' AND confirmed_by IS NULL AND confirmed_at IS NULL AND voided_by IS NULL AND voided_at IS NULL)
  OR (status='confirmed' AND confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL AND voided_by IS NULL AND voided_at IS NULL)
  OR (status='voided' AND confirmed_by IS NULL AND confirmed_at IS NULL AND voided_by IS NOT NULL AND voided_at IS NOT NULL)
 )
);
CREATE INDEX idx_manual_payments_order ON public.manual_payments(tenant_id,order_id,status);
CREATE INDEX idx_manual_payments_tenant ON public.manual_payments(tenant_id,created_at DESC);
CREATE UNIQUE INDEX idx_manual_payments_reference ON public.manual_payments(tenant_id,method,reference)
 WHERE reference IS NOT NULL AND status='confirmed';
-- Accounting entries from manual-payment confirmation must be idempotent.
CREATE UNIQUE INDEX idx_transactions_manual_reference ON public.transactions(tenant_id,reference_id)
 WHERE reference_id IS NOT NULL AND type='income';

ALTER TABLE public.manual_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY manual_payment_owner_read ON public.manual_payments FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.tenant_members m
 WHERE m.tenant_id=manual_payments.tenant_id AND m.user_id=(SELECT auth.uid())
 AND m.role IN ('owner','manager'))
 OR EXISTS(SELECT 1 FROM public.orders o WHERE o.tenant_id=manual_payments.tenant_id AND o.id=manual_payments.order_id
 AND o.customer_user_id=(SELECT auth.uid()))
);
CREATE POLICY manual_payment_backend ON public.manual_payments FOR ALL TO barberos_backend USING(true) WITH CHECK(true);
REVOKE ALL ON public.manual_payments FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.manual_payments TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.manual_payments TO barberos_backend;

ALTER TABLE public.subscription_plans ADD COLUMN billing_enabled boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.subscription_plans.billing_enabled IS
'False while Wompi is deferred. Zero prices are placeholders, not a billing promise.';
COMMENT ON TABLE public.manual_payments IS
'Operator-recorded offline payments; confirmed means a staff member attested collection, NOT a Wompi confirmation.';
COMMIT;
