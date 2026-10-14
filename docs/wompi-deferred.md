# BarberOS — Wompi para vender BarberOS, integración pospuesta

**Decisión del propietario (octubre 2026):** Wompi se utilizará exclusivamente para que dueños de barberías y profesionales paguen por adquirir y usar el sistema BarberOS desde una landing page futura. NO se utilizará para las reservas, servicios o pedidos que las barberías cobren a sus propios clientes.

**Wompi NO está implementado ni conectado:** no hay checkout, claves de comercio, webhooks, suscripciones cobrables ni enlaces de pago. La landing page y el frontend no se tocan ahora.

## Dominios de cobro independientes

| Ámbito | Quien paga | Cómo funciona hoy | Wompi |
|---|---|---|---|
| Operación de barbería | Cliente final paga al negocio | Registro de efectivo/transferencia por personal autorizado, inventario y caja | Nunca |
| Suscripción BarberOS | Negocio/profesional paga al operador de BarberOS | Planes no cobrables; sin checkout ni renovación | Exclusivamente aquí, en la futura landing page |

manual_payments es para PEDIDOS DE PRODUCTOS DE LAS BARBERÍAS, no para cobrar BarberOS.
subscription_plans y tenant_subscriptions son modelos de la suscripción del software; los importes cero actuales son PLACEHOLDERS, no ofertas comerciales.

## Contrato actual de capacidades del backend

GET /api/v1/public/payment-capabilities:

- manualPayments.enabled = true: registros manuales de los comercios.
- onlinePayments.enabled = false; providerSelected = null; scope = barbershop_orders:
  no se integra una pasarela para pagos de clientes de barberías.
- platformBilling.providerSelected = wompi;
  platformBilling.scope = barberos_saas_subscriptions;
  platformBilling.checkoutSurface = future_landing_page;
  platformBilling.enabled = false: proveedor reservado solo para vender BarberOS.
- subscriptionBilling.enabled = false: sin facturación recurrente.

Nunca reutilizar manual_payments o las transacciones de caja de barberías para la contabilidad de la plataforma SaaS. Sus fondos y libros contables son distintos.

## APIs operativas sin Wompi

- GET /api/v1/tenants/:tenantId/orders/:orderId/payments
- POST /api/v1/tenants/:tenantId/orders/:orderId/payments/manual
- POST /api/v1/tenants/:tenantId/payments/:paymentId/confirm-manual
- POST /api/v1/tenants/:tenantId/payments/:paymentId/void-pending

Estas APIs registran pagos offline de pedidos de los negocios. Una confirmación manual refleja la declaración de su personal, no una confirmación bancaria.

## Implementación de Wompi para la landing page: SOLO FUTURO

No comenzar hasta que el backend esté terminado y el usuario presente la landing page.

1. Acordar precios COP de planes de BarberOS, periodo de prueba, renovación, cambios de plan, facturación, cancelación y reembolsos.
2. Diseñar checkout exclusivamente para contratar BarberOS, nunca para pagar servicios de barbería.
3. Crear un ledger financiero separado para pagos de la plataforma, intentos, transacciones, webhooks y suscripciones. Aislar empresas y asegurar idempotencia.
4. Mantener secretos del comercio únicamente en backend; separar sandbox y producción.
5. Verificar criptográficamente los eventos y comprobar importe, moneda, referencia, suscripción y transacción antes de habilitar un plan.
6. Implementar conciliación, fallos, disputas, reembolsos, posible renovación y recuperación. No asumir que Wompi procesa recurrencia automáticamente: revisar capacidades vigentes.
7. Activar solo con dominio, HTTPS, pruebas integrales, monitoreo y aprobación del propietario.

Documentación oficial para revisar al implementar: https://docs.wompi.co/docs/colombia/

## Continuidad ahora

Seguir con seguridad multiempresa, agenda y reprogramación, inventario, caja,
notificaciones, Storage, Realtime, pruebas y despliegue. La integración comercial
de Wompi en la landing page queda fuera del alcance operativo actual por decisión
expresa del propietario. No declarar el backend terminado hasta probar el resto.
