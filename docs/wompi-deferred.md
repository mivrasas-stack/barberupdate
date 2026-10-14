# BarberOS — Wompi seleccionado, integración aplazada

**Decisión de producto (13 de octubre de 2026):** La pasarela definitiva será Wompi.
**Estado obligatorio actual:** NO INTEGRAR NI ACTIVAR WOMPI HASTA LA ETAPA DE PRODUCCIÓN.
**Ámbito:** Solo BarberOS, proyecto Supabase `wrfwhftzaflwhkvkzrjm` y GitHub `mivrasas-stack/barberupdate`. Frontend intacto.

## Qué funciona ahora

- Reservas y agenda NO requieren una compra en línea para reservar.
- Pedidos e inventario: creación atómica y reserva de existencias; cancelación devuelve stock.
- El propietario o gerente puede crear **un registro de pago manual pendiente** de un pedido, especificando cantidad y método (efectivo, transferencia o medio offline aceptado).
- Un propietario o gerente debe confirmar por separado que recibió ese pago: las transferencias necesitan una referencia y el efectivo queda como constancia del operador.
- La confirmación añade una sola transacción de ingresos a la caja, dentro de la misma transacción PostgreSQL; la clave de idempotencia evita duplicación de registros.
- Nunca se permite marcar confirmado un importe mayor al total del pedido; la confirmación duplicada es rechazada.
- Un pedido con dinero confirmado **no se puede cancelar de forma automática**. Antes debe existir un proceso explícito de devolución/reembolso, por seguridad contable.
- Las suscripciones y sus importes de ejemplo son **no cobrables**: `billing_enabled=false`; los valores 0 almacenados son placeholders y NO significan que se ofrece el servicio gratis.
- `GET /api/v1/public/payment-capabilities` informa `onlinePayments.enabled=false`, `providerSelected=wompi`, `providerConnected=false`, `subscriptionBilling.enabled=false`.
- Ningún endpoint de Wompi, credencial del comercio, webhook de cobro, token de tarjeta, checkout ni solicitud HTTP al gateway funciona o existe todavía. No hay cobro real en línea.
- Sigue prohibido modificar el frontend hasta que finalice el backend y se autorice su integración.

## Contratos API (presentes, bajo JWT salvo consulta pública)

- `GET /api/v1/public/payment-capabilities`: características disponibles.
- `GET /api/v1/tenants/:tenantId/orders/:orderId/payments`: importes y saldo de un pedido, visible para propietario/gerente o su cliente.
- `POST /api/v1/tenants/:tenantId/orders/:orderId/payments/manual`: genera registro **pendiente**. Cuerpo: `{"amountMinor":12500,"method":"transfer"}`; header obligatorio `Idempotency-Key` (12 a 100 caracteres), acceso propietario/gerente.
- `POST /api/v1/tenants/:tenantId/payments/:paymentId/confirm-manual`: constancia **verificada manualmente por el personal**, cuerpo `{"reference":"TRX-12345"}`. Transferencias y métodos distintos a efectivo requieren referencia de al menos tres caracteres. Solo propietario/gerente.
- `POST /api/v1/tenants/:tenantId/payments/:paymentId/void-pending`: anula un registro pendiente, sin movimiento de dinero. Un pago confirmado no puede anularse por este medio.
- `GET /api/v1/public/plans`: cada plan expone `billing_enabled=false` mientras no existan tarifas y un proveedor activo.

Todos los importes del backend se expresan en unidades menores de moneda (`amountMinor`).
La confirmación manual **no significa** que Wompi, un banco o una red de tarjetas haya aprobado el pago.

## Diseño para enchufar Wompi cuando corresponda

La integración futura se hará mediante un adaptador **server-side**, sin cambiar la lógica central de reservas y pedidos:
1. Crear el contrato de pasarela: crear intento de pago, leer estado verificado, confirmar evento, iniciar reembolso, conciliar transacciones, registrar fallos e idempotencia.
2. Crear tablas de intents/eventos financieros inmutables o extender mediante migración (NO reutilizar `manual_payments` para aparentar una aprobación de Wompi).
3. Construir checkout con referencia y monto calculados en servidor a partir de la orden; nunca aceptar importes definitivos del navegador.
4. Configurar las credenciales de Wompi exclusivamente como secretos del servidor y separar **sandbox** y **producción**.
5. Verificar integridad criptográfica de los eventos antes de cualquier cambio de estado, comprobar referencia, moneda, monto y `transaction_id`, deduplicar eventos y aceptar entregas fuera de orden.
6. El navegador solo verá estados verificados; nunca estará autorizado a marcar un pago como aprobado.
7. Activar el flujo únicamente con HTTPS, dominio, monitoreo, pruebas de webhooks/reembolsos, conciliación, política de disputas y autorización explícita del propietario.
8. Acordar moneda: **Wompi Colombia admite actualmente COP en su API de transacciones**. El SaaS almacena otras monedas para otras regiones; no permitir Wompi en comercios USD/EUR sin reglas comerciales/FX válidas.
9. Definir precios reales de suscripciones, periodos, prorrateos, expiración, reintentos, comisiones e impuestos antes de habilitar cobro.

Documentación oficial consultada al preparar este plan:
- https://docs.wompi.co/docs/colombia/widget-checkout-web/
- https://docs.wompi.co/docs/colombia/transacciones/
- https://docs.wompi.co/docs/colombia/eventos/

Las condiciones y APIs pueden cambiar: releer documentación oficial **cuando se implemente** Wompi. No se almacena ninguna clave de Wompi ahora.

## Fases y límites

- **Backend funcional sin cobros en línea:** reservas, catálogos, inventario, pagos manuales registrados, clientes, empleados, caja, reportes, notificaciones internas.
- **Fase de lanzamiento comercial:** habilitar Wompi mediante trabajo y pruebas aparte, con definición de precios, HTTPS, protección antifraude, webhooks firmados, conciliación, reembolsos.
- **La plataforma no debe etiquetarse 100% productiva** mientras queden incompletos disponibilidad 24/7, notificaciones externas, carga, copias verificadas, observabilidad y controles operacionales.
