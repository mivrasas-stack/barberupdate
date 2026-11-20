-- Add a separately opted-in professional notification to future bookings.
-- Do not alter or replay customer WhatsApp jobs or existing appointments.
BEGIN;
-- Older installations may not have the independently-consented barber fields.
ALTER TABLE public.barbers ADD COLUMN IF NOT EXISTS whatsapp_phone text NOT NULL DEFAULT '';
ALTER TABLE public.barbers ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT false;
ALTER TABLE public.whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_event_kind_check;
ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_event_kind_check
  CHECK(event_kind IN ('created','reminder','rescheduled','cancelled','barber_created'));

CREATE OR REPLACE FUNCTION public.barberos_whatsapp_queue_barber_appointment()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  barber_record record;
  assigned_phone text;
BEGIN
  IF NEW.status <> 'confirmed' OR NEW.starts_at<=now() THEN RETURN NEW; END IF;

  SELECT b.user_id,b.whatsapp_phone,b.whatsapp_opt_in,b.status,
         t.status AS tenant_status,
         c.enabled AS whatsapp_enabled,
         c.templates->'barber_created'->>'name' AS template_name
  INTO barber_record
  FROM public.barbers b
  JOIN public.tenants t ON t.id=b.tenant_id
  LEFT JOIN public.whatsapp_tenant_settings c ON c.tenant_id=b.tenant_id
  WHERE b.tenant_id=NEW.tenant_id AND b.id=NEW.barber_id;

  IF barber_record.user_id IS NULL OR barber_record.whatsapp_opt_in IS DISTINCT FROM true
     OR barber_record.status<>'active' OR barber_record.tenant_status<>'active'
     OR barber_record.whatsapp_enabled IS DISTINCT FROM true
     OR COALESCE(barber_record.template_name,'')=''
  THEN RETURN NEW; END IF;

  -- Only a valid canonical destination opted in by the professional is accepted.
  assigned_phone:=regexp_replace(COALESCE(barber_record.whatsapp_phone,''),'[[:space:]().-]','','g');
  IF assigned_phone ~ '^3[0-9]{9}$' THEN assigned_phone:='+57'||assigned_phone; END IF;
  IF assigned_phone ~ '^573[0-9]{9}$' THEN assigned_phone:='+'||assigned_phone; END IF;
  IF assigned_phone !~ '^\+573[0-9]{9}$' THEN RETURN NEW; END IF;

  INSERT INTO public.whatsapp_messages(
    tenant_id,appointment_id,user_id,phone_e164,event_kind,event_version,scheduled_at)
  VALUES (NEW.tenant_id,NEW.id,barber_record.user_id,assigned_phone,'barber_created',0,now())
  ON CONFLICT(tenant_id,appointment_id,event_kind,event_version) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.barberos_whatsapp_queue_barber_appointment()
  FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS appt_whatsapp_barber_created ON public.appointments;
CREATE TRIGGER appt_whatsapp_barber_created
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.barberos_whatsapp_queue_barber_appointment();
COMMIT;