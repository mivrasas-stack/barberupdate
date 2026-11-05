-- BarberNow owns its approved WhatsApp templates centrally.
-- All barbershops inherit identical defaults. No shop owner config or approval is required.
-- Explicit per-customer WhatsApp consent is STILL checked by the appointment trigger and worker.
-- Do not backfill/replay old appointments: only subsequent eligible appointment events enqueue.
CREATE OR REPLACE FUNCTION public.barberos_whatsapp_platform_templates()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT '{
    "created":{"name":"confirmacion_de_reserva","params":["customer_name","date","time","barber_name","business_name","business_name"],"headerText":"💈"},
    "reminder":{"name":"recordatorio_cita_cliente","params":["customer_name","barber_name","date","time","business_name"],"headerText":"🟢"},
    "rescheduled":{"name":"cita_reprogramada_cliente","params":["customer_name","barber_name","date","time"],"headerText":"⏳"},
    "cancelled":{"name":"cita_cancelada","params":["customer_name","business_name","cancellation_reason"],"headerText":"😕"}
  }'::jsonb;
$$;

-- Schema-level defaults protect manual/internal tenant creation paths too.
ALTER TABLE public.whatsapp_tenant_settings ALTER COLUMN enabled SET DEFAULT true;
ALTER TABLE public.whatsapp_tenant_settings ALTER COLUMN language_code SET DEFAULT 'es';
ALTER TABLE public.whatsapp_tenant_settings ALTER COLUMN templates SET DEFAULT public.barberos_whatsapp_platform_templates();

-- Provision every existing tenant including QA and independent operators; no messages
-- are sent by this migration. Opt-in, real appointment events and the worker remain required.
INSERT INTO public.whatsapp_tenant_settings
  (tenant_id,enabled,language_code,reminder_hours,templates)
SELECT t.id,true,'es',24,public.barberos_whatsapp_platform_templates()
FROM public.tenants t
ON CONFLICT (tenant_id) DO UPDATE SET
  enabled=true,
  language_code='es',
  reminder_hours=24,
  templates=public.barberos_whatsapp_platform_templates(),
  updated_at=now();

-- Automatic onboarding: new tenants inherit templates on creation without
-- a business owner ever visiting the WhatsApp settings page.
CREATE OR REPLACE FUNCTION public.barberos_whatsapp_auto_provision_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  INSERT INTO public.whatsapp_tenant_settings
    (tenant_id,enabled,language_code,reminder_hours,templates)
  VALUES (NEW.id,true,'es',24,public.barberos_whatsapp_platform_templates())
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.barberos_whatsapp_auto_provision_tenant() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS tenant_whatsapp_auto_provision ON public.tenants;
CREATE TRIGGER tenant_whatsapp_auto_provision
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.barberos_whatsapp_auto_provision_tenant();
