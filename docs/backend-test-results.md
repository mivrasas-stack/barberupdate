# BarberOS — pruebas verificadas contra Supabase dedicado

Fecha de esta ronda: 2026-10-13/14 (hora local UTC-5).
Equipo y carpeta: LAPTOP-TT7C3PL5, `C:\MIVRA PROYECTS\UPDATEBARBER`.
Proyecto único: Supabase `wrfwhftzaflwhkvkzrjm`.

| Comprobación | Resultado |
|---|---|
| Migraciones Supabase | 12 registradas, 22 tablas públicas con RLS (incluye `manual_payments`) |
| Asesor de seguridad de Supabase | 0 avisos |
| `npm audit --omit=dev` tras actualizar Fastify 5.12.7 | 0 vulnerabilidades de cualquier severidad |
| `npm run check` | correcto |
| `npm test` | 4 pruebas automáticas correctas, 2 integrales se omiten deliberadamente sin activación explícita |
| `RUN_DB_INTEGRATION=1` | 1 test SQL real correcto; `ROLLBACK` automático, sin datos persistentes |
| `RUN_LIVE_API_INTEGRATION=1` | 1 test HTTP real correcto (Auth, tenant, horarios, slots, reservas, idempotencia, orden, stock, caja, notificaciones, informes) |
| Eliminación de fixtures | usuario temporal y tenant eliminados tras test; último recuento SQL: 0 tenants `barberos-itest-*` |
| PostgreSQL conectado desde API | rol `barberos_backend`, no BYPASSRLS, sin usar el administrador en containers |
| Endpoint `/api/v1/health/ready` | `ready` |
| Docker | 2 APIs, Caddy localhost, Redis saludable y worker |
| Frontend | 0 cambios en archivos frontend protegidos |

## Prueba de carga posterior al parche

`node backend/scripts/load-smoke.mjs` desde el directorio backend, contra `http://127.0.0.1:8188`:

- 450 solicitudes: **450 HTTP 200**, sin errores.
- 400 solicitudes `/health/live`, concurrencia 12: **1826,5 RPS locales**.
- 50 consultas `/public/plans`, concurrencia 6: **50,2 RPS locales**.
- Latencia conjunta p50 **4,9 ms**, p95 **91,7 ms**, p99 **113,2 ms**.

**Limitación:** estos números son un *smoke test* acotado, no resultados de reservas
con 1000 sesiones ni garantía de SLA. También mezclan dos endpoints de costes distintos.
No generalizar el RPS de health al rendimiento transaccional PostgreSQL ni a una
máquina de producción. Las cuotas del plan Free pueden limitar la carga sostenida.

## Bloqueos todavía abiertos

- Configurar proveedor de cobros reales, webhooks firmados, reembolsos y suscripciones.
- Configurar proveedor de correo/SMS/push con consentimientos y tasas de entrega.
- Ampliar cobertura E2E de todos los roles (cliente, barbero, gerente, propietario),
  estados anómalos, carrera de cancelaciones y fotos reales de Storage.
- Generar carga con calendarios, reservas concurrentes, clientes distribuidos y
  medir p95 de transacciones y conexiones sostenidas.
- Producir despliegue TLS en host 24/7, restauración de copia ensayada,
  alertas, observabilidad, política de capacidad y respuesta a incidentes.
- Completar reprogramación, liquidación comisiones y pagos fiscales según
  reglas de negocio aprobadas.

No conectar el frontend todavía. No declarar 100% de backend productivo.


## Pagos manuales y Wompi diferido (2026-10-13)

- Migración `011`: registro `manual_payments` con RLS, FKs de empresa, claves de idempotencia y referencia contable única.
- La API expone `GET /api/v1/public/payment-capabilities` con Wompi elegido y desactivado.
- E2E real: pago pendiente, replay idempotente, rechazo al modificar solicitud, obligación de comprobante para transferencia, confirmación manual, rechazo de doble confirmación, saldo de pedido cero y bloqueo de cancelación de un pedido abonado.
- La confirmación manual genera transacción de ingreso atómica. No existe pasarela de pago real ni cargos online.
- Wompi seguirá **sin implementación ni credenciales** hasta producción, por decisión explícita del usuario.
- Es necesario completar las otras condiciones de producción antes de considerar el backend 100% apto para lanzamiento.
- Plan: `docs/wompi-deferred.md`.

## Nueva fase de agenda y separación comercial (octubre de 2026)

- Reprogramación por cliente: PATCH /api/v1/me/bookings/:appointmentId/reschedule.
- Reprogramación por propietario o gerente: PATCH /api/v1/tenants/:tenantId/appointments/:appointmentId/reschedule.
- La validación conserva la duración original, impide mover una cita completada o cancelada, respeta horarios y ausencias, y evita dobles reservas mediante la exclusión PostgreSQL.
- Bloqueo de agenda consistente para evitar carreras entre creación de cita, horarios, ausencia y reprogramación; notificación y evento sin PII al cambiar fecha/barbero.
- Prueba E2E ampliada: dos propietarios y empresas independientes, rechazo de acceso a servicios, pedidos, informes y horarios de la otra empresa; reprogramación de cliente y administrador; rechazo de conflictos. Eliminación comprobada de los datos temporales.
- Wompi exclusivamente para vender suscripciones a BarberOS, por una landing page futura. Cero cobros de Wompi a clientes finales de barberías. Véase docs/wompi-deferred.md.

## Supabase Storage: prueba E2E real

- Se generó una URL firmada para una imagen PNG de prueba del propietario de BarberOS.
- Un usuario propietario de otra barbería recibió HTTP 403 al intentar generar la URL para ese negocio.
- Se subió el PNG mínimo a Storage con el token firmado, se recuperó desde la URL pública y se verificó HTTP 200.
- La prueba eliminó posteriormente el objeto Storage, las dos barberías y los dos usuarios temporales; ninguna imagen de usuarios reales fue alterada.
- La prueba está incorporada en backend/test/live-api.test.js y solamente se ejecuta con RUN_LIVE_API_INTEGRATION=1.

## Validación multirol y concurrencia (ronda posterior)

- Se añadieron pruebas opt-in en backend/test/concurrency.test.js para tres usuarios independientes: propietario, gerente y barbero.
- Se confirmó que el gerente puede administrar servicios y horarios, pero no asignar roles de miembros.
- Se confirmó que el barbero no puede crear productos, leer reportes financieros ni leer agendas ajenas; sí puede ver sus reservas asignadas.
- Con dos solicitudes HTTP simultáneas al mismo horario, PostgreSQL produjo exactamente un HTTP 201 y un HTTP 409; persistió una sola reserva.
- Con dos pedidos simultáneos por la única unidad restante, hubo exactamente un HTTP 201 y un HTTP 409; inventario final cero y sin pedidos duplicados.
- Con la misma Idempotency-Key simultánea se obtuvo HTTP 201/200, un único pedido y un solo descuento de inventario.
- Prueba real aprobada, con empresa y tres usuarios temporales eliminados al terminar.
- Ejecutar en backend con RUN_LIVE_CONCURRENCY=1: node --env-file=.env --env-file=.env.admin.local --test test/concurrency.test.js

## Validación WebSocket Supabase Realtime

- Se añadió backend/test/realtime.test.js, prueba opt-in de notificaciones por Postgres Changes para propietario y usuario externo.
- Primera ejecución: SUBSCRIBED, pero no recibió la notificación en 16 segundos; se marcó FALLIDA y se limpiaron los datos.
- Segunda ejecución: permiso RLS comprobado por REST (propietario ve evento, tercero ve cero), y evento Realtime entregado por canales filtrado/no filtrado; usuario ajeno recibió cero eventos.
- Resultado segunda ejecución: APROBADA. La intermitencia de la primera prueba no queda resuelta como garantía de estabilidad. Repetir y probar reconexión antes de producción.
- La prueba limpió empresa y dos usuarios. Ejecutar con RUN_LIVE_REALTIME=1: node --env-file=.env --env-file=.env.admin.local --test test/realtime.test.js

- Wompi permanece elegido SOLO para vender BarberOS desde la futura landing page; ningún cobro de barberías utiliza Wompi.
