-- BarberOS phase 2: auditable, time-zone-safe appointment rescheduling.
-- Wompi will be used only for future SaaS subscriptions on a separate landing page.
BEGIN;
ALTER TABLE public.appointments
  ADD COLUMN reschedule_count integer NOT NULL DEFAULT 0
    CHECK(reschedule_count BETWEEN 0 AND 100);

CREATE OR REPLACE FUNCTION public.barberos_track_reschedule()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF (NEW.starts_at,NEW.ends_at,NEW.barber_id)
     IS DISTINCT FROM (OLD.starts_at,OLD.ends_at,OLD.barber_id) THEN
    IF OLD.status NOT IN ('pending','confirmed') THEN
      RAISE EXCEPTION 'Appointment cannot be rescheduled in current state' USING ERRCODE='23514';
    END IF;
    IF OLD.reschedule_count>=100 THEN
      RAISE EXCEPTION 'Reschedule limit reached' USING ERRCODE='23514';
    END IF;
    NEW.reschedule_count=OLD.reschedule_count+1;
  ELSE
    NEW.reschedule_count=OLD.reschedule_count;
  END IF;
  RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.barberos_track_reschedule() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER appt_track_reschedule BEFORE UPDATE OF starts_at,ends_at,barber_id,reschedule_count
ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.barberos_track_reschedule();

CREATE OR REPLACE FUNCTION public.barberos_reschedule_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (NEW.starts_at,NEW.ends_at,NEW.barber_id)
     IS NOT DISTINCT FROM (OLD.starts_at,OLD.ends_at,OLD.barber_id) THEN
    RETURN NEW;
  END IF;
  -- Event payload deliberately omits customer PII, phone and full appointment details.
  INSERT INTO public.outbox_events(tenant_id,topic,payload)
  VALUES(NEW.tenant_id,'appointment.rescheduled',
    jsonb_build_object('appointmentId',NEW.id,'tenantId',NEW.tenant_id,
      'rescheduleCount',NEW.reschedule_count));
  IF NEW.customer_user_id IS NOT NULL THEN
    INSERT INTO public.notifications(tenant_id,user_id,category,reference_id,event_status,title,body)
    VALUES(NEW.tenant_id,NEW.customer_user_id,'booking',NEW.id,
      'rescheduled-'||NEW.reschedule_count::text,'Reserva reprogramada',
      'Consulta la nueva fecha de tu reserva en BarberOS')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.barberos_reschedule_notify() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER appt_reschedule_notify AFTER UPDATE OF starts_at,ends_at,barber_id
ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.barberos_reschedule_notify();
COMMIT;
