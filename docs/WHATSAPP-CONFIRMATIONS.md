# Confirmación de reservas por WhatsApp (solo salida)

Esta integración NO recibe respuestas ni requiere webhook. Se registra un evento de envío en la misma transacción que crea una reserva nueva; reintentos HTTP con la misma Idempotency-Key de reserva no generan otro evento. El worker procesa el evento cuando WHATSAPP_SEND_ENABLED=true. Los fallos de WhatsApp no cancelan la reserva.

## Configuración privada en backend/.env
- WHATSAPP_ACCESS_TOKEN: token válido de Meta, nunca en frontend/Git.
- WHATSAPP_PHONE_NUMBER_ID: identificador del número en WhatsApp Cloud API.
- WHATSAPP_GRAPH_VERSION: versión Graph API soportada por Meta (ejemplo v23.0).
- WHATSAPP_TEMPLATE_NAME=barberos_booking_confirmation
- WHATSAPP_TEMPLATE_LANGUAGE=es (debe coincidir exactamente con la plantilla aprobada).
- WHATSAPP_SEND_ENABLED=false inicialmente, activar true solo después de preparar plantilla, consentimiento y pruebas.

En WhatsApp Manager crear y aprobar una plantilla UTILITY llamada barberos_booking_confirmation para idioma es, con exactamente cuatro variables de cuerpo en este orden:
1. Nombre del cliente
2. Nombre de la barbería
3. Fecha local de la cita
4. Hora local de la cita

Ejemplo de cuerpo: "Hola {{1}}, tu cita en {{2}} quedó registrada para el {{3}} a las {{4}}. ¡Te esperamos!"
La plantilla debe corresponder a una comunicación autorizada por el cliente; obtener y conservar consentimiento adecuado antes del envío.

## Activación
1. Ejecutar migraciones existentes de Supabase (no se requiere migración nueva, se reutiliza public.outbox_events).
2. Configurar la plantilla y credenciales en backend/.env. No subirlo a Git.
3. Ejecutar npm test dentro de backend y probar el flujo con un número autorizado, primero con SEND_ENABLED=false.
4. Cambiar WHATSAPP_SEND_ENABLED=true y reiniciar el worker. Con Docker Compose, la configuración se pasa al worker mediante infra/compose.yaml.
5. Comprobar eventos public.outbox_events donde topic='whatsapp.booking_confirmation': processed_at indica aceptación por la API de Meta, NO entrega al dispositivo. El contador attempts refleja reintentos. Si alcanzan 12, el evento queda pendiente pero deja de reintentarse automáticamente.

## Límites
- Sin webhook no hay confirmación de entrega/lectura.
- La API de Meta puede aceptar un mensaje aunque falle la respuesta de red; un reintento podría duplicar el envío. Para garantías más estrictas se necesitaría reconciliación adicional.
- Los mensajes de reservas canceladas antes del procesamiento se omiten.
- Los eventos pendientes creados mientras está desactivado el envío se procesarán cuando se active; revisar los pendientes antes de activarlo.
- Los números deben estar en formato internacional, preferiblemente con prefijo del país.
- Esta primera versión usa UN número de Meta para todas las barberías.
