-- BarberOS phase 3: immutable and auditable OFFLINE refund ledger.
-- Wompi is ONLY reserved for the future BarberOS SaaS landing-page checkout.
-- NEVER triggers a bank payment or online card reimbursement.
BEGIN;
ALTER TABLE public.manual_payments
 ADD CONSTRAINT manual_payments_tenant_id_id_unique UNIQUE(tenant_id,id);

CREATE TABLE public.manual_refunds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 payment_id uuid NOT NULL,
 order_id uuid NOT NULL,
 amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 1000000000000),
 currency text NOT NULL CHECK(currency IN ('COP','USD','EUR')),
 method text NOT NULL CHECK(method IN ('cash','transfer','debit','credit','nequi','daviplata')),
 reason text NOT NULL CHECK(length(reason) BETWEEN 8 AND 400),
 reference text CHECK(reference IS NULL OR length(reference) BETWEEN 3 AND 120),
 created_by uuid NOT NULL,
 idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 12 AND 100),
 request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT manual_refunds_payment_fk FOREIGN KEY(tenant_id,payment_id)
   REFERENCES public.manual_payments(tenant_id,id) ON DELETE RESTRICT,
 CONSTRAINT manual_refunds_order_fk FOREIGN KEY(tenant_id,order_id)
   REFERENCES public.orders(tenant_id,id) ON DELETE CASCADE,
 UNIQUE(tenant_id,created_by,idempotency_key)
);
CREATE INDEX idx_manual_refunds_payment ON public.manual_refunds(tenant_id,payment_id);
CREATE INDEX idx_manual_refunds_order ON public.manual_refunds(tenant_id,order_id,created_at DESC);
CREATE UNIQUE INDEX idx_manual_refunds_receipt ON public.manual_refunds(tenant_id,method,reference)
 WHERE reference IS NOT NULL;
CREATE UNIQUE INDEX idx_transactions_manual_refund ON public.transactions(tenant_id,reference_id)
 WHERE reference_id IS NOT NULL AND type='expense';

ALTER TABLE public.manual_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY manual_refunds_visible ON public.manual_refunds FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.tenant_members m
  WHERE m.tenant_id=manual_refunds.tenant_id
    AND m.user_id=(SELECT auth.uid()) AND m.role IN ('owner','manager'))
 OR EXISTS(SELECT 1 FROM public.orders o
  WHERE o.tenant_id=manual_refunds.tenant_id AND o.id=manual_refunds.order_id
    AND o.customer_user_id=(SELECT auth.uid()))
);
CREATE POLICY manual_refunds_backend ON public.manual_refunds
 FOR ALL TO barberos_backend USING(true) WITH CHECK(true);
REVOKE ALL ON public.manual_refunds FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.manual_refunds TO authenticated;
GRANT SELECT,INSERT ON public.manual_refunds TO barberos_backend;

COMMENT ON TABLE public.manual_refunds IS
'Immutable operator-attested OFFLINE refunds of barber shop order payments. This table does not transfer money and is unrelated to future Wompi SaaS billing.';
COMMIT;