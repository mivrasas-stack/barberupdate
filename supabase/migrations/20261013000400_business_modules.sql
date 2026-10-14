-- Business modules: atomic orders, tenant-aware financial closing, reviews, loyalty.
BEGIN;
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_user_id uuid NOT NULL,
  customer_name text NOT NULL CHECK(length(customer_name) BETWEEN 1 AND 120),
  pickup_code text NOT NULL CHECK(pickup_code ~ '^PK-[A-Z0-9]{8}$'),
  total_minor bigint NOT NULL CHECK(total_minor >= 0),
  status text NOT NULL DEFAULT 'received'
    CHECK(status IN ('received','preparing','ready','delivered','cancelled')),
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,customer_user_id,idempotency_key),
  UNIQUE(tenant_id,pickup_code),
  UNIQUE(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_date ON public.orders(tenant_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_date ON public.orders(customer_user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.order_items(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  order_id uuid NOT NULL,
  product_id uuid NOT NULL,
  product_name text NOT NULL,
  unit_price_minor bigint NOT NULL CHECK(unit_price_minor >= 0),
  quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 1000),
  subtotal_minor bigint GENERATED ALWAYS AS (unit_price_minor * quantity) STORED,
  FOREIGN KEY(tenant_id,order_id) REFERENCES public.orders(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY(tenant_id,product_id) REFERENCES public.products(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  barber_id uuid NOT NULL,
  customer_user_id uuid NOT NULL,
  rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment text NOT NULL DEFAULT '' CHECK(length(comment)<=2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id,barber_id) REFERENCES public.barbers(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_tenant ON public.reviews(tenant_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.loyalty_accounts (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  points integer NOT NULL DEFAULT 0 CHECK(points >= 0),
  visits_count integer NOT NULL DEFAULT 0 CHECK(visits_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,user_id)
);
CREATE TABLE IF NOT EXISTS public.loyalty_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  appointment_id uuid,
  points_delta integer NOT NULL CHECK(points_delta<>0),
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id,user_id) REFERENCES public.loyalty_accounts(tenant_id,user_id),
  UNIQUE(tenant_id,appointment_id)
);
CREATE INDEX IF NOT EXISTS idx_loyalty_events_user ON public.loyalty_events(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.cash_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  closing_date date NOT NULL,
  opening_cash_minor bigint NOT NULL CHECK(opening_cash_minor >= 0),
  cash_income_minor bigint NOT NULL CHECK(cash_income_minor >= 0),
  electronic_income_minor bigint NOT NULL CHECK(electronic_income_minor >= 0),
  cash_expenses_minor bigint NOT NULL CHECK(cash_expenses_minor >= 0),
  withdrawals_minor bigint NOT NULL CHECK(withdrawals_minor >= 0),
  actual_cash_minor bigint NOT NULL CHECK(actual_cash_minor >= 0),
  theoretical_cash_minor bigint GENERATED ALWAYS AS
    (opening_cash_minor + cash_income_minor - cash_expenses_minor - withdrawals_minor) STORED,
  notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
  closed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,closing_date)
);
CREATE INDEX IF NOT EXISTS idx_cash_closings_tenant ON public.cash_closings(tenant_id,closing_date DESC);

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  audience text NOT NULL CHECK(audience IN ('independent','barbershop')),
  monthly_minor bigint NOT NULL CHECK(monthly_minor >= 0),
  annual_minor bigint NOT NULL CHECK(annual_minor >= 0),
  currency text NOT NULL DEFAULT 'COP',
  max_barbers integer NOT NULL CHECK(max_barbers >= 1),
  max_portfolio_images integer NOT NULL CHECK(max_portfolio_images >= 0),
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES public.subscription_plans(id),
  status text NOT NULL CHECK(status IN ('trial','active','past_due','cancelled')),
  period_starts_at timestamptz NOT NULL,
  period_ends_at timestamptz NOT NULL,
  provider_subscription_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(period_ends_at > period_starts_at)
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON public.tenant_subscriptions(tenant_id,created_at DESC);

INSERT INTO public.subscription_plans (id,name,audience,monthly_minor,annual_minor,max_barbers,max_portfolio_images,features)
VALUES ('starter-shop','Starter Barberia','barbershop',0,0,3,10,'["bookings","profiles"]'::jsonb),
       ('pro-shop','Pro Barberia','barbershop',0,0,20,100,'["bookings","profiles","inventory","finance"]'::jsonb),
       ('pro-independent','Pro Independiente','independent',0,0,1,20,'["bookings","profiles"]'::jsonb)
ON CONFLICT(id) DO NOTHING;
-- Plan catalog prices are placeholders, not billable offers.

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY order_customer_or_manager ON public.orders FOR SELECT TO authenticated USING
(customer_user_id=(SELECT auth.uid()) OR EXISTS(
 SELECT 1 FROM public.tenant_members m WHERE m.tenant_id=orders.tenant_id
 AND m.user_id=(SELECT auth.uid()) AND m.role IN ('owner','manager')));
CREATE POLICY order_item_customer_or_manager ON public.order_items FOR SELECT TO authenticated USING
(EXISTS (SELECT 1 FROM public.orders o WHERE o.id=order_id AND o.tenant_id=order_items.tenant_id
 AND (o.customer_user_id=(SELECT auth.uid()) OR EXISTS
 (SELECT 1 FROM public.tenant_members m WHERE m.tenant_id=o.tenant_id
 AND m.user_id=(SELECT auth.uid()) AND m.role IN ('owner','manager')))));
CREATE POLICY review_own_read ON public.reviews FOR SELECT TO authenticated USING
(customer_user_id=(SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.tenant_members m
 WHERE m.tenant_id=reviews.tenant_id AND m.user_id=(SELECT auth.uid()) AND m.role IN ('owner','manager')));
CREATE POLICY loyalty_self_read ON public.loyalty_accounts FOR SELECT TO authenticated
USING(user_id=(SELECT auth.uid()));
CREATE POLICY loyalty_events_self_read ON public.loyalty_events FOR SELECT TO authenticated
USING(user_id=(SELECT auth.uid()));
CREATE POLICY cash_owner_read ON public.cash_closings FOR SELECT TO authenticated USING
(EXISTS(SELECT 1 FROM public.tenant_members m WHERE m.tenant_id=cash_closings.tenant_id
 AND m.user_id=(SELECT auth.uid()) AND m.role IN ('owner','manager')));
CREATE POLICY plans_public_read ON public.subscription_plans FOR SELECT TO anon,authenticated USING (is_active);
CREATE POLICY subscription_owner_read ON public.tenant_subscriptions FOR SELECT TO authenticated USING
(EXISTS(SELECT 1 FROM public.tenant_members m WHERE m.tenant_id=tenant_subscriptions.tenant_id
 AND m.user_id=(SELECT auth.uid()) AND m.role='owner'));

REVOKE ALL ON public.orders,public.order_items,public.reviews,public.loyalty_accounts,public.loyalty_events,
public.cash_closings,public.subscription_plans,public.tenant_subscriptions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.orders,public.order_items,public.reviews,public.loyalty_accounts,
public.loyalty_events,public.cash_closings,public.tenant_subscriptions TO authenticated;
GRANT SELECT ON public.subscription_plans TO anon,authenticated;

-- Sensitive state transitions emitted without customer PII.
CREATE OR REPLACE FUNCTION public.barberos_order_outbox() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 INSERT INTO public.outbox_events(tenant_id,topic,payload)
 VALUES(NEW.tenant_id,'order.changed',jsonb_build_object('orderId',NEW.id,'status',NEW.status,'tenantId',NEW.tenant_id));
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.barberos_order_outbox() FROM PUBLIC;
CREATE TRIGGER orders_outbox AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.barberos_order_outbox();
COMMIT;
