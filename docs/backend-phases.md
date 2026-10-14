# BarberOS — fases y definición de backend terminado

**Alcance:** solo `C:\MIVRA PROYECTS\UPDATEBARBER\backend`, `supabase`, `infra` y `docs`.
**Protegido:** frontend `src/`, `index.html`, `package.json` raíz y `vite.config.ts`.
**Supabase exclusivo:** `wrfwhftzaflwhkvkzrjm`. **Git:** `mivrasas-stack/barberupdate`.
Los porcentajes indican avance estimado, no cobertura de código ni SLA demostrado.

| Fase | Qué exige la aceptación al 100% | Implementación validada | Pendiente / bloqueo |
|---|---|---|---|
| 1. Autenticación, seguridad y aislamiento | JWT confiables; políticas por empresa y rol; propietario inmutable; cuenta SQL sin BYPASSRLS; amenazas y abuso revisados | Supabase Auth, RLS en todas las tablas públicas, propiedad protegida, rol PostgreSQL exclusivo probado en E2E, limitador Redis | Prueba de penetración, revisión exhaustiva de todas las rutas, monitor de abuso |
| 2. Reservas y disponibilidad | Altas/consultas/estados/cancelación/reprogramación, horarios por empleado, ausencias, conflicto atómico y calendario en zonas horarias | Reservas y reprogramación seguras, ausencias, jornadas y **cierres excepcionales de empresa por fecha**, protegidos frente a reservas concurrentes mediante SQL | Cierres recurrentes y variantes de horario por fecha, zonas horarias extremas y casuística de calendario definida por el negocio |
| 3. Operación de negocios | Catálogo, productos, inventario, pedidos, cobros conciliados, caja, reseñas, fidelización, reportes | Pedidos, stock, caja, reseñas, puntos y reportes; cobros y **devoluciones manuales E2E aprobadas**, integridad contable reforzada directamente en PostgreSQL | Comprobantes/impuestos, conciliación bancaria, liquidación de comisiones y reglas comerciales por definir. Wompi NO pertenece a pedidos de barberías |
| 4. Integraciones y tiempo real | Storage seguro, Auth, Realtime por negocio, correo/SMS/push, y preparación SaaS | Storage firmado probado con subida/lectura/borrado; WebSocket Realtime de notificaciones y RLS de destinatario **verificados en E2E**; outbox Redis; Wompi reservado solo para el futuro SaaS | **Realtime intermitente en la última regresión**: sincronización REST con cursor implementada como alternativa; falta recuperar fiabilidad del WebSocket, ensayos prolongados y proveedores externos autorizados |
| 5. Pruebas y escalabilidad | Pruebas funcionales exhaustivas, concurrentes, latencia p95, 1k sesiones, restauración y resiliencia | E2E multirol; caída API (14/14 HTTP 200) y Redis (6/6 indisponibilidad y recuperación); reservas 10/10 a concurrencia 5 (p95 nueva muestra 1.245 ms); **restauración aislada del esquema public actual: 24 tablas RLS, 3 planes, 16 triggers, 48 políticas** | Carga sostenida y 1000 sesiones; fallo Supabase; restauración integral Auth y Storage; validar rendimiento estadísticamente |
| 6. Producción | TLS/dominio, backups/restauración, CI/CD controlada, observabilidad, alertas, cuotas y seguridad de despliegue | Docker aislado; monitor local; plantilla TLS Caddy y preflight validado; proxy endurecido contra suplantación de IP y rate-limit compartido; ensayo parcial de restauración pública | Dominio, servidor 24/7, secretos gestionados, alertas externas, restauración completa Auth/Storage, pruebas de seguridad y autorización explícita |

## Resumen de trabajo verificado

- Proyecto Supabase BarberOS con migraciones 001–016; la 013 incorpora devoluciones manuales, la 014 protege la integridad financiera, la 015 agrega cierres excepcionales y la 016 añade sincronización de notificaciones con cursor. Wompi queda únicamente para la futura venta de BarberOS. Wompi se reserva solo para las futuras suscripciones SaaS de BarberOS desde la landing page. No se alteran otros proyectos.
- `barberos_backend` es rol NO BYPASSRLS con privilegios de tablas acotados. Admin URI solo está en `backend/.env.admin.local` ignorado por Git; la API usa el rol restringido.
- `npm run check` y `npm test` validan sintaxis y contratos básicos.
- Test SQL remoto real: `RUN_DB_INTEGRATION=1 node --env-file=.env --env-file=.env.admin.local --test test/integration.test.js`. Todos los datos se revierten por `ROLLBACK`.
- Test E2E: `RUN_LIVE_API_INTEGRATION=1 node --env-file=.env --env-file=.env.admin.local --test test/live-api.test.js`. Crea usuario/empresa temporales, prueba y elimina ambos. Requiere contenedores activos y conexión al proyecto dedicado.
- Test de carga sin riesgos de producción: `node scripts/load-smoke.mjs`, 450 peticiones locales máximo. No representa 1000 sesiones ni mide reservas bajo carga.
- No se almacena contraseña, token JWT ni clave privada en Git; los scripts de prueba generan datos efímeros.

## Para poder declarar backend 100% terminado

Para poder declarar la plataforma apta para producción se requieren decisiones de negocio y accesos que no deben inventarse:
1. **Wompi será EXCLUSIVAMENTE para vender planes de BarberOS desde la futura landing page**, no para cobrar citas ni pedidos de clientes de barberías. Su integración se aplaza hasta completar backend, revisar landing page y preparar producción. Véase `docs/wompi-deferred.md`.
2. Proveedor de correo/SMS/push y remitente autorizado, política de consentimientos.
3. Dominio y entorno de producción 24/7 con certificados TLS, políticas de disponibilidad y presupuesto.
4. Volumen objetivo aprobado (usuarios, barberos, reservas diarias y p95), pruebas de estrés contra entorno de staging y recuperación.
5. Reglas de negocio: cancelación/reembolsos, vacaciones, comisiones, fidelización y requisitos legales/fiscales.

**Distinguir dos entregables:** (1) backend funcional completo según reglas de negocio aprobadas; (2) backend apto para producción con recuperación integral, seguridad y monitoreo comprobados. Ni uno ni otro se declara al 100% por estimación. La futura integración Wompi de la landing page está explícitamente diferida y NO bloquea el desarrollo de módulos operativos de las barberías. No conectar el frontend original sin autorización.

## Reglas para todo cambio

1. Solo modificar archivos `backend/`, `infra/`, `supabase/`, `docs/` y automatización de backend.
2. Ejecutar pruebas, comprobar RLS y asesor de seguridad de Supabase tras cada migración.
3. Nunca migrar bases ajenas ni afectar otros contenedores.
4. No subir `.env` ni secretos, usar conexiones locales protegidas.
5. No exponer el puerto 8188 más allá de `127.0.0.1` sin TLS y auditoría.
