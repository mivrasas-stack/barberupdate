# BarberOS — pruebas verificadas contra Supabase dedicado

Fecha de esta ronda: 2026-10-13/14 (hora local UTC-5).
Equipo y carpeta: LAPTOP-TT7C3PL5, `C:\MIVRA PROYECTS\UPDATEBARBER`.
Proyecto único: Supabase `wrfwhftzaflwhkvkzrjm`.

| Comprobación | Resultado |
|---|---|
| Migraciones Supabase | 11 registradas, 22 tablas públicas con RLS (incluye `manual_payments`) |
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
