-- Use the approved UTILITY appointment confirmation with emojis on new bookings.
-- All previously sent messages remain unchanged; no replay, no backfill.
-- Preserve the reminder, reschedule, cancellation and future barber preferences.
BEGIN;
CREATE OR REPLACE FUNCTION public.barberos_whatsapp_platform_templates()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT '{
    "created":{"name":"barbernow_confirmacion_cita_emojis_v2","params":["customer_name","business_name","date","time","barber_name","customer_name","business_name"]},
    "reminder":{"name":"recordatorio_cita_cliente","params":["customer_name","barber_name","date","time","business_name"],"headerText":"🟢"},
    "rescheduled":{"name":"cita_reprogramada_cliente","params":["customer_name","barber_name","date","time"],"headerText":"⏳"},
    "cancelled":{"name":"cita_cancelada","params":["customer_name","business_name","cancellation_reason"],"headerText":"😕"}
  }'::jsonb;
$$;
ALTER TABLE public.whatsapp_tenant_settings
 ALTER COLUMN templates SET DEFAULT public.barberos_whatsapp_platform_templates();

UPDATE public.whatsapp_tenant_settings SET
 templates=jsonb_set(templates,'{created}',jsonb_build_object(
   'name','barbernow_confirmacion_cita_emojis_v2',
   'params',jsonb_build_array('customer_name','business_name','date','time','barber_name','customer_name','business_name')
 ),true),
 updated_at=now()
WHERE enabled=true AND templates->'created'->>'name' IN (
 'confirmacion_de_reserva','barbernow_confirmacion_cita_util_v1',
 'barbernow_confirmacion_emoji_util_v2','barbernow_confirmacion_cita_emojis_v2'
);
COMMIT;