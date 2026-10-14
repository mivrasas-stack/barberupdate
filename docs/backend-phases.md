# BarberOS — fases y definición de backend terminado

**Alcance:** solo `C:\MIVRA PROYECTS\UPDATEBARBER\backend`, `supabase`, `infra` y `docs`.
**Protegido:** frontend `src/`, `index.html`, `package.json` raíz y `vite.config.ts`.
**Supabase exclusivo:** `wrfwhftzaflwhkvkzrjm`. **Git:** `mivrasas-stack/barberupdate`.
Los porcentajes indican avance estimado, no cobertura de código ni SLA demostrado.

| Fase | Qué exige la aceptación al 100% | Implementación validada | Pendiente / bloqueo |
|---|---|---|---|
| 1. Autenticación, seguridad y aislamiento | JWT confiables; políticas por empresa y rol; propietario inmutable; cuenta SQL sin BYPASSRLS; amenazas y abuso revisados | Supabase Auth, RLS en todas las tablas públicas, propiedad protegida, rol PostgreSQL exclusivo probado en E2E, limitador Redis | Prueba de penetración, revisión exhaustiva de todas las rutas, monitor de abuso |
| 2. Reservas y disponibilidad | Altas/consultas/estados/cancelación/reprogramación, horarios por empleado, ausencias, conflicto atómico y calendario en zonas horarias | Horarios y ausencias con validación PostgreSQL; slots públicos; reservas atómicas y sin duplicados; cancelación del cliente; E2E aprobado | Reprogramación, excepciones festivos recurrentes, variantes de horario y UX del calendario |
| 3. Operación de negocios | Catálogo, productos, inventario, pedidos, cobros conciliados, caja, reseñas, fidelización, reportes | Productos, stock transaccional, pedidos/cancelación, caja, reportes, reseñas, puntos por cita completada, notificaciones internas; **registro y confirmación de pagos manuales** con idempotencia y caja atómica | Facturación, reembolsos, conciliación Wompi diferida, liquidación real de comisiones |
| 4. Integraciones y tiempo real | Storage seguro, Auth, Realtime por negocio, correo/SMS/push, webhooks verificables, suscripciones cobrables | Storage firmado; publicaciones Realtime: citas, pedidos, notificaciones; outbox Redis; Auth verificado; Wompi elegido **pero desconectado** | Wompi y facturación recurrente aplazados expresamente hasta producción; proveedores externos y pruebas websocket reales |
| 5. Pruebas y escalabilidad | Pruebas funcionales exhaustivas, concurrentes, latencia p95, 1k sesiones, restauración y resiliencia | Tests unitarios, transacciones SQL con rollback, E2E con Auth y limpieza, Docker doble réplica, ensayo de carga local limitado | Test concurrente de carga sostenida; p95 real de reservas; corte de red y recuperación, 1k sesiones |
| 6. Producción | TLS/dominio, backups/restauración, CI/CD controlada, observabilidad, alertas, cuotas y seguridad de despliegue | Compose aislado con Caddy, Redis, 2 API y worker; GitHub CI; .env secretos ignorados; red local-only | Dominio, TLS perimetral, despliegue con alta disponibilidad externa, copias verificadas, alertas y políticas de retención completas |

## Resumen de trabajo verificado

- Proyecto Supabase BarberOS con migraciones 001–011; la migración 011 incluye el registro de pagos manuales, sin activar Wompi. No se alteran otros proyectos.
- `barberos_backend` es rol NO BYPASSRLS con privilegios de tablas acotados. Admin URI solo está en `backend/.env.admin.local` ignorado por Git; la API usa el rol restringido.
- `npm run check` y `npm test` validan sintaxis y contratos básicos.
- Test SQL remoto real: `RUN_DB_INTEGRATION=1 node --env-file=.env --env-file=.env.admin.local --test test/integration.test.js`. Todos los datos se revierten por `ROLLBACK`.
- Test E2E: `RUN_LIVE_API_INTEGRATION=1 node --env-file=.env --env-file=.env.admin.local --test test/live-api.test.js`. Crea usuario/empresa temporales, prueba y elimina ambos. Requiere contenedores activos y conexión al proyecto dedicado.
- Test de carga sin riesgos de producción: `node scripts/load-smoke.mjs`, 450 peticiones locales máximo. No representa 1000 sesiones ni mide reservas bajo carga.
- No se almacena contraseña, token JWT ni clave privada en Git; los scripts de prueba generan datos efímeros.

## Para poder declarar backend 100% terminado

Se requieren decisiones de negocio y accesos que no deben inventarse:
1. **Pasarela ya seleccionada: Wompi Colombia.** Su integración se aplaza por decisión del usuario hasta producción. Para activarla después se requerirán cuenta de comercio, credenciales, webhooks verificados, precios COP y reglas de renovaciones/reembolsos. Véase `docs/wompi-deferred.md`.
2. Proveedor de correo/SMS/push y remitente autorizado, política de consentimientos.
3. Dominio y entorno de producción 24/7 con certificados TLS, políticas de disponibilidad y presupuesto.
4. Volumen objetivo aprobado (usuarios, barberos, reservas diarias y p95), pruebas de estrés contra entorno de staging y recuperación.
5. Reglas de negocio: cancelación/reembolsos, vacaciones, comisiones, fidelización y requisitos legales/fiscales.

Hasta que estos criterios se validen, **no declarar el backend 100% ni conectar el frontend original**.

## Reglas para todo cambio

1. Solo modificar archivos `backend/`, `infra/`, `supabase/`, `docs/` y automatización de backend.
2. Ejecutar pruebas, comprobar RLS y asesor de seguridad de Supabase tras cada migración.
3. Nunca migrar bases ajenas ni afectar otros contenedores.
4. No subir `.env` ni secretos, usar conexiones locales protegidas.
5. No exponer el puerto 8188 más allá de `127.0.0.1` sin TLS y auditoría.
