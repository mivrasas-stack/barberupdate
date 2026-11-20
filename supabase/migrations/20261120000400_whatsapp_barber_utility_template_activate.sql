-- Activate approved UTILITY template for opted-in professionals on future bookings.
-- Trigger fires only AFTER INSERT; no backfill or replay of existing appointments.
BEGIN;
CREATE OR REPLACE FUNCTION public.barberos_whatsapp_platform_templates()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT '{
  "created":{"name":"barbernow_confirmacion_cita_emojis_v2","params":["customer_name","business_name","date","time","barber_name","customer_name","business_name"]},
  "barber_created":{"name":"barbernow_nueva_cita_barbero_util_v1","params":["barber_name","business_name","customer_name","service_name","date","time"]},
  "reminder":{"name":"recordatorio_cita_cliente","params":["customer_name","barber_name","date","time","business_name"],"headerText":"🟢"},
  "rescheduled":{"name":"cita_reprogramada_cliente","params":["customer_name","barber_name","date","time"],"headerText":"⏳"},
  "cancelled":{"name":"cita_cancelada","params":["customer_name","business_name","cancellation_reason"],"headerText":"😕"}
 }'::jsonb;
$$;
ALTER TABLE public.whatsapp_tenant_settings
 ALTER COLUMN templates SET DEFAULT public.barberos_whatsapp_platform_templates();

UPDATE public.whatsapp_tenant_settings SET
 templates=jsonb_set(templates,'{barber_created}',jsonb_build_object(
  'name','barbernow_nueva_cita_barbero_util_v1',
  'params',jsonb_build_array('barber_name','business_name','customer_name','service_name','date','time')
 ),true),
 updated_at=now()
WHERE enabled=true;
COMMIT;