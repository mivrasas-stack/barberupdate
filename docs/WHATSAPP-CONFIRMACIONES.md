# WhatsApp: mensajes de citas (BarberNow - CRM)
Rama de implementación: feature/whatsapp-booking-templates.

## Plantillas de Meta (idioma configurado con WHATSAPP_LANGUAGE; por defecto es)
Estas plantillas deben existir, estar aprobadas y tener variables de BODY en el orden indicado.
El texto fijo, emojis y pie "BarberNow - CRM" se gestionan dentro de Meta, no en el backend.
- confirmacion_de_reserva: {{1}} nombre del cliente, {{2}} nombre barbería, {{3}} fecha, {{4}} hora, {{5}} barbero.
- nueva_cita_barbero: {{1}} nombre barbero, {{2}} cliente, {{3}} fecha, {{4}} hora.
- cita_cancelada: {{1}} nombre cliente, {{2}} barbería. **La plantilla menciona no asistencia y por eso SOLO se envía en estado no_show.** La cancelación normal no envía esa plantilla.
- recordatorio_cita_cliente: {{1}} nombre cliente, {{2}} barbero, {{3}} fecha, {{4}} hora; una hora antes.

## Preparación
1. Aplicar la migración 20261014000400_whatsapp_notifications.sql en la base BarberOS.
2. Establecer WHATSAPP_ACCESS_TOKEN completo, WHATSAPP_PHONE_NUMBER_ID completo, WHATSAPP_GRAPH_VERSION soportada, y WHATSAPP_LANGUAGE exactamente igual al idioma aprobado (por ejemplo es o es_CO).
3. Mantener WHATSAPP_SEND_ENABLED=false hasta validar plantillas, número y autorizaciones. No publicar secretos en GitHub/frontend.
4. Capturar whatsappOptIn:true al reservar solo con consentimiento afirmativo del cliente (false por defecto).
5. Configurar para cada barbero whatsapp_phone y whatsapp_opt_in mediante PATCH /api/v1/tenants/:tenantId/barbers/:barberId/whatsapp (propietario/gerente, con permiso del barbero).
6. Ejecutar el worker existente; cuando todo esté listo activar WHATSAPP_SEND_ENABLED=true solamente en el backend y worker.
7. Probar con números autorizados y comprobar whatsapp_deliveries. Estado 'sent' significa aceptado por Meta, no entregado al móvil.
8. Sin webhook no se conoce lectura/entrega, solo aceptación del API.

## Consideraciones
- Las reservas persisten aunque Meta falle. Los errores se registran y reintentan acotadamente; un fallo de red ambiguo podría producir duplicados.
- Las notificaciones iniciales se encolan al insertar citas nuevas, aunque la cita comience con estado pending (en esta API la creación confirma la reserva del usuario). La misma reserva con la misma clave idempotente no se reenviará.
- El recordatorio no se envía para citas canceladas, expiradas ni para reservas registradas menos de una hora antes.
- Se evita alterar el comportamiento existente de las rutas de reservas/cancelaciones.
