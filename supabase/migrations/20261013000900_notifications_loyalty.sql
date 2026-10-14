-- Phase 3/4: idempotent loyalty awards, safe user notifications, Realtime.
BEGIN;
CREATE TABLE public.notifications(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  category text NOT NULL CHECK(category IN ('booking','order','loyalty')),
  reference_id uuid NOT NULL,
  event_status text NOT NULL CHECK(length(event_status) BETWEEN 1 AND 40),
  title text NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
  body text NOT NULL DEFAULT '' CHECK(length(body)<=300),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,user_id,category,reference_id,event_status)
);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id,created_at DESC)
 WHERE read_at IS NULL;
CREATE INDEX idx_notifications_user_feed ON public.notifications(user_id,created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_self_read ON public.notifications FOR SELECT TO authenticated
USING(user_id=(SELECT auth.uid()));
CREATE POLICY notifications_self_mark_read ON public.notifications FOR UPDATE TO authenticated
USING(user_id=(SELECT auth.uid()))
WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY notifications_backend ON public.notifications FOR ALL TO barberos_backend USING(true) WITH CHECK(true);
REVOKE ALL ON public.notifications FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE(read_at) ON public.notifications TO authenticated;
GRANT SELECT,UPDATE(read_at) ON public.notifications TO barberos_backend;

CREATE OR REPLACE FUNCTION public.barberos_record_loyalty()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE inserted_event uuid;
BEGIN
  IF NEW.status='completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.customer_user_id IS NOT NULL THEN
    INSERT INTO public.loyalty_accounts(tenant_id,user_id,points,visits_count)
      VALUES(NEW.tenant_id,NEW.customer_user_id,0,0) ON CONFLICT DO NOTHING;
    INSERT INTO public.loyalty_events(tenant_id,user_id,appointment_id,points_delta,description)
      VALUES(NEW.tenant_id,NEW.customer_user_id,NEW.id,10,'completed appointment')
      ON CONFLICT(tenant_id,appointment_id) DO NOTHING RETURNING id INTO inserted_event;
    IF inserted_event IS NOT NULL THEN
      UPDATE public.loyalty_accounts
      SET points=points+10,visits_count=visits_count+1,updated_at=now()
      WHERE tenant_id=NEW.tenant_id AND user_id=NEW.customer_user_id;
    END IF;
  END IF;
  RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.barberos_record_loyalty() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER appointments_loyalty_on_complete AFTER UPDATE OF status ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.barberos_record_loyalty();

CREATE OR REPLACE FUNCTION public.barberos_customer_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE who uuid;
DECLARE kind text;
DECLARE msg text;
DECLARE owner_id uuid;
BEGIN
  IF TG_TABLE_NAME='appointments' THEN
    who:=NEW.customer_user_id;
    kind:='booking';
    msg:=CASE NEW.status
      WHEN 'pending' THEN 'Reserva solicitada'
      WHEN 'confirmed' THEN 'Reserva confirmada'
      WHEN 'waiting' THEN 'Te esperamos'
      WHEN 'in_service' THEN 'Servicio iniciado'
      WHEN 'completed' THEN 'Servicio terminado'
      WHEN 'cancelled' THEN 'Reserva cancelada'
      ELSE 'Actualizacion de reserva' END;
  ELSE
    who:=NEW.customer_user_id;
    kind:='order';
    msg:=CASE NEW.status
      WHEN 'received' THEN 'Pedido recibido'
      WHEN 'preparing' THEN 'Preparando pedido'
      WHEN 'ready' THEN 'Pedido listo para retirar'
      WHEN 'delivered' THEN 'Pedido entregado'
      ELSE 'Pedido cancelado' END;
  END IF;
  IF TG_OP='UPDATE' AND NEW.status=OLD.status THEN RETURN NEW; END IF;
  IF who IS NOT NULL THEN
    INSERT INTO public.notifications(tenant_id,user_id,category,reference_id,event_status,title,body)
      VALUES(NEW.tenant_id,who,kind,NEW.id,NEW.status,msg,'Consulta el detalle en BarberOS')
    ON CONFLICT DO NOTHING;
  END IF;
  IF TG_OP='INSERT' THEN
    SELECT owner_user_id INTO owner_id FROM public.tenants WHERE id=NEW.tenant_id;
    IF owner_id IS NOT NULL AND owner_id IS DISTINCT FROM who THEN
      INSERT INTO public.notifications(tenant_id,user_id,category,reference_id,event_status,title,body)
        VALUES(NEW.tenant_id,owner_id,kind,NEW.id,NEW.status,
          CASE kind WHEN 'booking' THEN 'Nueva reserva' ELSE 'Nuevo pedido' END,'Revisa la actividad del negocio')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.barberos_customer_notification() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER appointments_customer_notifications AFTER INSERT OR UPDATE OF status ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.barberos_customer_notification();
CREATE TRIGGER orders_customer_notifications AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.barberos_customer_notification();

DO $do$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
   IF NOT EXISTS(SELECT 1 FROM pg_publication_tables
     WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notifications') THEN
     ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
   END IF;
   IF NOT EXISTS(SELECT 1 FROM pg_publication_tables
     WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='orders') THEN
     ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
   END IF;
 END IF;
END $do$;
COMMIT;
