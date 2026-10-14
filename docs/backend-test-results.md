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

## Resiliencia operativa: failover y monitor

- Caddy cambio de /api/v1/health/live a /api/v1/health/ready para evaluar PostgreSQL y Redis de ambas replicas. Health check cada 10 s con deteccion pasiva y reintentos.
- Se detuvo SOLO barberos-updatebackend-api1-1 y se ejecutaron 14 comprobaciones por el balanceador: 14 HTTP 200, cero errores.
- api1 restaurada en finally, replicas API1/API2, Caddy, Redis y worker operativos; readiness final HTTP 200.
- Se agrego backend/scripts/health-monitor.mjs: verifica readiness, planes y que Wompi permanezca desactivado; salida JSON con latencias y exit 1 ante fallo.
- Se agregaron tres pruebas del monitor (HTTPS remoto obligatorio, salud nominal y fallo cerrado); los tres casos pasaron.
- Monitor real: 3/3 endpoints HTTP 200, estado healthy. Carga local anterior no equivale a alta disponibilidad ante caida del host.
- Supabase Advisor: 0 hallazgos de seguridad; 9 indices sin uso identificados como informativos, no eliminados sin analisis.
- Recuperacion y backups pendientes de ensayo real; procedimiento detallado en docs/operations-recovery.md.

## Ejecucion controlada de fase 5/6 (Redis, reservas y preflight)

- Se detuvo SOLO Redis de Docker en el stack BarberOS. Durante el fallo, 6/6 consultas readiness fueron rechazadas (0 HTTP 200). Se restauro el servicio en finally y la API recupero HTTP 200. Solo el contenedor BarberOS Redis se detuvo.
- Test real con tenant aislado: diez reservas nuevas en distintos horarios, cinco workers concurrentes, 10 HTTP 201. Latencia p95 observada 2001 ms. No representa carga sostenida ni 1000 sesiones; buscar optimizacion.
- Se anadio test de monitor de preparacion de produccion: 3/3 casos aprobados. Con .env actual, preflight devuelve ready=false y exit code 1 de manera intencional.
- infra/caddy/Caddyfile.production.example validado en contenedor Caddy temporal con --network none, sin abrir puertos ni cambiar Caddy local. TLS real NO desplegado.
- Fase 6 permanece sin terminar: restauracion real de backup, servidor 24/7, dominio, HTTPS, alertas, seguridad e integracion con frontend no aprobados.
- Checklist de pendientes y procedimiento seguro: docs/production-launch-checklist.md.

## Ultima validacion: restauracion, rendimiento y proxy

- Ensayo real `backend/scripts/restore-public-drill.mjs`: streaming pg_dump en TLS desde SOLO el proyecto Supabase BarberOS hacia PostgreSQL 17 local y efimero con `--network none` y sin publicar puertos. No se genero fichero de backup persistente.
- Restauracion publica completada: 22/22 tablas, 22/22 con RLS, 3 planes, 12 triggers, 44 policies; 109785 bytes de stream; duracion observada 19 segundos. Contenedor temporal eliminado automaticamente.
- Alcance limitado: solamente el schema `public`. Auth, objetos de Storage, otras extensiones, roles del sistema y la capacidad de restaurar un desastre completo NO estan certificados.
- Se optimizo POST reservas a una consulta INSERT SELECT que valida servicio, barbero, precio y duracion sin perder el exclusion constraint, RLS del servidor ni advisory lock.
- Se repitio E2E HTTP real tras la optimizacion: Auth, empresas, programacion, idempotencia, notificaciones, pedidos, caja, reportes y Storage aprobaron; limpieza de pruebas completa.
- Segunda muestra de carga real: 10/10 reservas aceptadas con concurrencia 5; p95 1245 ms frente a 2001 ms en muestra anterior. Muestras pequenas; no hay garantia estadistica de rendimiento ni SLA.
- IP por cliente anonimo: Fastify confia exclusivamente en el salto Caddy inmediato; Caddy sobrescribe X-Forwarded-For con su IP observada. Test de cabecera spoofed aprobado; requiere adaptar config si se instala otro proxy/CDN.
- Suite local: 13 pruebas aprobadas, 4 pruebas integrales opt-in omitidas en modo local; Caddy validado, monitor local 3/3 correcto, dos APIs y worker desplegados.

## Prioridad funcional: devoluciones parciales/totales de pedidos (migracion 013)

- Supabase proyecto dedicado: migracion 013 aplicada; manual_refunds tiene RLS habilitado, dos politicas, indices para acceder por pedido/pago y permisos de INSERT/SELECT al rol limitado del backend; anon no puede leer la tabla.
- Se agrego API de reembolso manual exclusiva de propietario/gerente, con limites, comprobante, motivo, idempotencia, historico y asiento de expense en la misma transaccion.
- Cancelacion de pedidos pagados: la API verifica importe cobrado menos reembolsado; solo cancela si el saldo recibido pendiente de devolver es cero. Devuelve stock solo cuando se cancela.
- backend/test/refunds.test.js incorpora cuatro pruebas locales: replay idempotente, referencias/limites, aislamiento de otra empresa y fallo inyectado del asiento financiero seguido de retry.
- Suite completa sin acceso real: 17 pruebas aprobadas, 4 integraciones opt-in omitidas; 0 fallidas.
- backend/test/live-api.test.js ampliado con dos devoluciones de un pago real de prueba, bloqueo de cancelacion parcial, validacion de saldos y retorno de stock; **esa prueba integral ampliada NO se ha podido ejecutar aun por bloqueo de la herramienta**. No se certifica este escenario E2E real ni la recuperacion de una caida de PostgreSQL con datos persistentes.
- Esta funcionalidad es solo contabilidad offline de barberias. El proyecto SaaS tiene Wompi desactivado y diferido a la futura landing page.

## Cierre técnico adicional: SQL contable, calendario y catch-up (migraciones 014-016)

- SQL 014 aplicado: trigger de comprobación de devoluciones contra pago confirmado, moneda/método, comprobante y total; trigger de inmutabilidad de pagos confirmados/anulados.
- Transacción real contra Supabase con ROLLBACK: devoluciones parciales válidas de 5.000 + 7.500, rechazo de exceso a 13.000, cambio de pago confirmado y moneda incorrecta.
- SQL 015 aplicado: cierres excepcionales por día, RLS y bloqueo coordinado con nuevas reservas. Transacción real con ROLLBACK confirmó rechazo de reserva en día cerrado y rechazo de cierre con reserva activa.
- E2E HTTP real previo aprobado para devoluciones, cierre/reapertura de calendario, Auth, permisos, inventario, caja y Storage; fixtures Auth/empresas/imágenes borrados.
- SQL 016: índice para sincronización incremental de notificaciones por usuario y par (created_at,id). La primera E2E detectó repeticiones de notificaciones: el cursor redondeaba microsegundos a milisegundos.
- Corrección: usar to_char de fecha exacta de PostgreSQL, conservando los seis decimales. Prueba unitaria verifica timestamp con precisión micro y aislamiento del usuario.
- En la última ejecución explícita de Realtime por WebSocket, el usuario no recibió eventos pese a SUBSCRIBED y confirmación de SELECT por REST; por eso Realtime NO está aprobado como entrega garantizada. La nueva API /notifications/sync es la alternativa de recuperación.
- Dos pruebas funcionales SQL aisladas y E2E de concurrencia/roles aprobaron. Último ensayo de reservas: 10/10 a concurrencia 5 con p95 1212 ms (muestra pequeña, sin SLA).
- Suite local tras la nueva API: 22 pruebas aprobadas, 4 integrales opt-in omitidas por defecto, 0 fallidas.
- No se ha validado estabilidad prolongada del proveedor Realtime, carga sostenida, recuperación completa Auth/Storage ni despliegue HTTPS real.

## Regresión definitiva posterior a corrección de microsegundos

- npm test: 26 tests registrados, 22 aprobados, 0 fallidos y 4 E2E opt-in omitidos en modo local.
- E2E HTTP completo con API de catch-up en Supabase: APROBADO, duración aproximada 47 s, 0 fallos. Conserva microsegundos del timestamp para evitar mensajes duplicados; las empresas, usuarios e imágenes temporales fueron borrados.
- E2E DB de integridad y E2E concurrente: APROBADOS. E2E Realtime WebSocket: FALLIDO en la última prueba; la API REST de sincronización está validada como alternativa, pero todavía no se certifica el WebSocket.
- Auditoría de dependencias: 0 altas y 0 críticas; monitor real saludable 3/3; preflight de producción devuelve ready=false intencionalmente.
- Informe de aceptación técnica y pendientes: docs/informe-cierre-backend.md.
