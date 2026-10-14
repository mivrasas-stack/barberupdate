-- Dedicated BarberOS project: additional FK indexes and relocate relocatable extension.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION btree_gist SET SCHEMA extensions;
CREATE INDEX IF NOT EXISTS idx_appt_service_fk ON public.appointments(tenant_id,service_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product_fk ON public.inventory_movements(tenant_id,product_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_events_fk ON public.loyalty_events(tenant_id,user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_fk ON public.order_items(tenant_id,order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_fk ON public.order_items(tenant_id,product_id);
CREATE INDEX IF NOT EXISTS idx_outbox_tenant_fk ON public.outbox_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reviews_barber_fk ON public.reviews(tenant_id,barber_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_fk ON public.tenant_subscriptions(plan_id);
COMMIT;
