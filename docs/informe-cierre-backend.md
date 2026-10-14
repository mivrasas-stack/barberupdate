# BarberOS — informe de verificación y cierre técnico (backend)

**Fecha:** 13–14 de octubre de 2026.
**Proyecto único:** `C:\MIVRA PROYECTS\UPDATEBARBER`; Supabase `wrfwhftzaflwhkvkzrjm`; GitHub `mivrasas-stack/barberupdate`.
**Estado:** núcleo funcional probado en entorno local; **NO certificado como backend de producción al 100%**.

## Resumen ejecutivo

Se implementaron y verificaron autenticación JWT, aislamiento de barberías, roles y propiedad, agenda y reprogramación, horarios/ausencias/cierres excepcionales, pedidos e inventario transaccional, pagos y devoluciones manuales, caja y cierres, notificaciones, fidelización, reportes, almacenamiento y conexiones Supabase. Wompi NO procesa pagos de barberías; está reservado y desactivado para una futura landing page de suscripciones a BarberOS.

El backend local consta de dos APIs Fastify, Redis, worker y balanceador Caddy, con puerto público limitado a `127.0.0.1:8188`. El frontend original no se modificó.

## Evidencia recopilada

| Criterio | Resultado |
|---|---|
| Migraciones de Supabase exclusivo | 16 aplicadas |
| Tablas públicas PostgreSQL con RLS | 24 de 24 |
| Alertas actuales del asesor de seguridad Supabase | 0 |
| Pruebas locales automáticas | 22 aprobadas, 0 fallidas; 4 integrales con activación explícita |
| E2E HTTP real Auth, multiempresa, agenda, inventario, pagos/devoluciones, caja, informes, Storage y cierres excepcionales | Aprobado; datos temporales eliminados |
| Prueba PostgreSQL transaccional de sobre-reembolso, pagos inmutables y consistencia de moneda | Aprobada; transacción revertida con ROLLBACK |
| Prueba PostgreSQL transaccional de cierres frente a reservas activas | Aprobada; transacción revertida con ROLLBACK |
| Caída de una réplica API local | 14/14 respuestas 200 por la réplica superviviente |
| Caída Redis local | 6/6 indicaron indisponibilidad; recuperación comprobada |
| Restauración aislada del esquema public (no datos reales en disco) | 22 tablas originales, 22 RLS, 3 planes, 12 triggers y 44 políticas; prueba histórica previa a nuevas migraciones |
| Reservas concurrentes | Ensayos limitados con bloqueo de doble reserva; p95 en muestra 1245 ms (10 reservas, concurrencia 5) |
| Backend compilado, Docker y monitor local | Validados |
| Vulnerabilidades altas/críticas de dependencias | 0 detectadas en la auditoría previa; comprobar nuevamente antes del lanzamiento |

**Importante:** el ensayo de restauración anterior cubre solamente el esquema público en el momento del ensayo. Las migraciones 013–015 añadieron nuevas estructuras; hay que repetir una restauración sobre la versión final y extenderla a Auth/Storage.

## Fases y criterios que faltan

| Fase | Estado verificable | Pendientes para declarar 100% |
|---|---|---|
| 1. Seguridad y multiempresa | JWT, RLS, SQL restringido y pruebas de roles funcionales | Auditoría independiente, pentest, seguimiento de abuso y revisión exhaustiva de autorización |
| 2. Agenda y reservas | Reservas, estados, reprogramación, ausencias, cierre excepcional por fecha, protección de conflictos | Calendarios especiales más complejos, zonas horarias extremas, casos de concurrencia y requisitos comerciales no definidos |
| 3. Operación y finanzas | Inventario, pedidos, caja, pagos/devoluciones manuales, puntos y reportes | Comprobantes/impuestos, conciliación financiera real, comisiones liquidadas y reglas de negocio definitivas |
| 4. Integraciones | Auth, Storage, Realtime internos probados | Estabilidad prolongada y proveedores de email/SMS/push si se requieren |
| 5. Confiabilidad | Failover local, Redis fail-closed, carga acotada, restauración parcial | Carga sostenida objetivo, fallos de Supabase/PostgreSQL, restauración completa Auth y Storage, medición RPO/RTO |
| 6. Producción | Plantilla TLS y preflight listos; API restringida a localhost | Dominio, host 24/7, certificados reales, monitor externo, alertas, backups completos y seguridad de despliegue |

**Wompi** no bloquea la entrega funcional: queda expresamente fuera del alcance actual. Se usará únicamente para cobrar suscripciones SaaS de BarberOS en la futura landing page, con implementación y pruebas posteriores y autorización separada.

## Requisitos externos y decisiones para cerrar producción

1. Alojamiento y dominio públicos, presupuesto de infraestructura y acceso al servidor/gestor de secretos.
2. Política de retención y destino de backups cifrados; restauración completa de PostgreSQL, Auth y Storage a un entorno independiente.
3. Objetivos medibles de rendimiento: usuarios concurrentes, reservas/día, latencia p95, disponibilidad y RPO/RTO.
4. Reglas de cancelaciones, cierre, comisiones, tributación y comprobantes que correspondan al negocio.
5. Decisión de si se requieren correo, SMS o push externos y qué proveedores/consentimientos autorizados utilizar.
6. Autorización del propietario para revisión de frontend y posterior despliegue. La landing page de venta SaaS y Wompi se tratarán en una fase separada.

## Conclusión

**No se debe declarar 100% ni desplegar comercialmente sin cumplir los criterios externos.** El código existente y las pruebas indican una base funcional avanzada, pero la producción real exige infraestructura, acuerdos de negocio y verificaciones que no pueden sustituirse por tests locales. El frontend queda intacto y los secretos fuera de Git.

Referencias: `docs/backend-phases.md`, `docs/backend-test-results.md`, `docs/production-launch-checklist.md`, `docs/wompi-deferred.md`, `docs/operations-recovery.md`.

## Actualización: incidencias y correcciones detectadas en la última regresión

- Migraciones 014–016: protección de integridad financiera en SQL, calendario de cierres excepcionales y cursor de sincronización de notificaciones.
- La prueba E2E del nuevo cursor detectó duplicados por pérdida de microsegundos al convertir fechas PostgreSQL a JavaScript; se corrigió conservando el timestamp exacto de seis decimales. La prueba de regresión local aprobó.
- Realtime por WebSocket falló en la última prueba repetida aunque la publicación, el slot de replicación y la lectura REST estaban disponibles. Esto impide declarar la entrega Realtime 100% fiable. Existe recuperación vía API REST /api/v1/me/notifications/sync.
- La prueba de recuperación de Auth y Storage a un entorno independiente NO está hecha. Tampoco hay infraestructura pública, backups durables ni alertas externas aprobadas.
- La valoración de entrega sigue siendo: **núcleo funcional avanzado y localmente operativo, pero NO completado al 100% para producción.** La evidencia tiene prioridad sobre cualquier porcentaje estimado.

## Última comprobación integral y control de lanzamiento

- E2E HTTP real de Auth, agenda, cierres excepcionales, reservas, devoluciones, inventario, informes, Storage y recuperación incremental de notificaciones: APROBADA tras corregir precisión de microsegundos, 0 fallos, fixtures eliminados.
- Regresión SQL y permisos multirol/concurrencia: APROBADAS; 10/10 reservas reales a concurrencia 5, p95 observado 1212 ms, sin implicar capacidad sostenida.
- Realtime por WebSocket: NO APROBADO en la última regresión de estabilidad. En cambio, REST con cursor recupera el historial del usuario y fue probado en E2E. Es necesario implementar uso de fallback en frontend cuando se autorice.
- npm audit --omit=dev: 0 vulnerabilidades altas/críticas. Monitor local: readiness, catálogo y capacidades 3/3 HTTP 200. Preflight de producción: ready=false, correcto porque faltan infraestructura y pruebas externas.
- Supabase exclusivo: 16 migraciones, 24 de 24 tablas con RLS y 0 alertas actuales de seguridad; 0 usuarios y 0 empresas de pruebas remanentes.
- El frontend original y los archivos de configuración raíz protegidos permanecen sin modificaciones.

## Nueva comprobación de resiliencia y despliegue (octubre de 2026)

- Ensayo actual de restore `backend/scripts/restore-public-drill.mjs` actualizado a migraciones 001-016, ejecutado con PostgreSQL 17 efímero aislado y `--network none`: restauró **24 tablas / 24 con RLS / 3 planes / 16 triggers / 48 políticas** en 17 segundos. El contenedor temporal se eliminó. No creó un backup durable.
- Auth y Storage del Supabase exclusivo tienen **0 usuarios** y **0 objetos del bucket barberos-images** a esta fecha. Esto evita datos de terceros en el ensayo, pero **no demuestra recuperación de cuentas, contraseñas, sesiones ni archivos reales** y no sustituye restauración completa en staging.
- Carga local acotada: **450 solicitudes HTTP 200 / 450**, 0 errores de red y 0 respuestas 5xx; p50 combinado 7,0 ms, p95 combinado 86,1 ms y p99 combinado 160,2 ms. Mezcla de health y catálogo, **no representa 1.000 clientes ni pruebas sostenidas de transacciones**.
- Auditoría npm de dependencias de producción: **0 vulnerabilidades altas y 0 críticas detectadas**.
- Preflight de producción: **ready=false**, correctamente; faltan dominio HTTPS, infraestructura 24/7, backup integral y restauración, alertas externas y revisión independiente.
- Frontend inspeccionado solo en lectura: `src/services/apiAdapter.ts` contiene `USE_MOCK_ADAPTER = true`; por tanto **no consume las rutas del backend real**. Se requiere adaptación, autenticación y pruebas de integración cuando el usuario autorice modificar frontend.
- La documentación oficial de Supabase indica que los cambios de Postgres vía Realtime no garantizan entrega de cada evento; la sincronización durable por REST `/api/v1/me/notifications/sync` debe ejecutarse en la futura integración del frontend, especialmente tras reconectar.

## Actualización: ensayos de los cuatro bloques y conexión del frontend

1. **Realtime:** nueva repetición de la prueba E2E falló: `SUBSCRIBED`, la API REST y las políticas RLS permiten leer la notificación de su destinatario, pero `REALTIME_DIAG_FILTERED=0`, `UNFILTERED=0`, `FOREIGN=0`. No es posible dar por certificada la entrega WebSocket; usar el catch-up REST ya validado, y diagnosticar el proveedor/eventos y reconexiones antes de producción.
2. **Backup/restore:** restauración aislada de la versión actual del esquema público aprobada: 24 tablas/24 RLS, 3 planes, 16 triggers y 48 políticas, 126660 bytes, 17 segundos. Container efímero eliminado, cloud intacto. La recuperación de Auth y objetos Storage NO está validada; hoy el proyecto tenía 0 usuarios y 0 objetos de Storage. No existe en esta prueba un backup durable.
3. **Carga y seguridad:** 450/450 HTTP 200, p50 7,0 ms, p95 86,1 ms, p99 160,2 ms en ruta de salud+catálogo local, sin reproducir mil sesiones ni ventas concurrentes. `npm audit --omit=dev` 0 altas, 0 críticas. Este smoke NO es benchmark de producción.
4. **Producción:** preflight `ready=false` por ausencia de dominio HTTPS, autorización, backup/restauración completa, alertas y revisión independiente. Caddy sigue en loopback `127.0.0.1:8188`. No se expusieron nuevos puertos.
5. **Frontend:** inspección read-only de `src/services/apiAdapter.ts`: `USE_MOCK_ADAPTER = true`. Clase HTTP preparada pero no conectada a los recursos reales, ni con integración JWT; el frontend no se modificó. Mapeo de contratos en `docs/frontend-backend-integration-contract.md`.

**Veredicto:** se han reforzado restauración de esquema y smoke local, pero los cuatro bloques NO están completados al 100% para producción. El usuario deberá aprobar infraestructura/staging, dominio, almacenamiento de backups, objetivos de rendimiento y revisión final de seguridad. Wompi permanece apagado y reservado solo para vender BarberOS en la futura landing page.
