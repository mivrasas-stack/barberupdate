# Backend BarberOS (NO modificar front)
Este directorio es independiente del frontend Vite. El frontend permanece
con adaptador mock; no se cambian src/, package.json, vite.config.ts ni index.html.

## Requisitos
Node 22+; Docker Desktop; proyecto Supabase dedicado; PostgreSQL y
Extensiones pgcrypto/btree_gist disponibles en Supabase.

## Solo backend, sin conexión pública
1. Configurar backend/.env local basado en .env.example; nunca subirlo a Git.
2. Migrar los archivos supabase/migrations/ en orden SOLO al proyecto BarberOS dedicado.
3. Supabase Auth habilitado, obtener URL, publishable key, service role server-only.
4. Conectar URL de PostgreSQL Supabase pooler; no usar DB de otra aplicación.
5. En terminal dentro de backend: npm ci && npm test; para arrancar local
   usar node --env-file=.env src/server.js (Node 22+).
6. En producción: docker compose --env-file backend/.env -f infra/compose.yaml up -d --build.
   Nota: desde raíz UPDATEBARBER (las rutas de .env son relativas al CLI).
7. Probar GET http://127.0.0.1:8188/api/v1/health/live y /health/ready.
   ready 503 significa dependencia ausente/no configurada.
8. Cloudflare/Caddy/TLS de borde: habilitar solo cuando haya dominio y certificados.

## Endpoints de v1
- GET /api/v1/health/live y /api/v1/health/ready
- GET /api/v1/me
- GET|POST /api/v1/tenants
- GET|POST /api/v1/tenants/:tenantId/members
- GET|POST /api/v1/tenants/:tenantId/barbers
- GET|POST /api/v1/tenants/:tenantId/services
- POST /api/v1/tenants/:tenantId/bookings (Idempotency-Key requerido)
- GET /api/v1/me/bookings
- GET /api/v1/tenants/:tenantId/appointments?start=<ISO>&end=<ISO>
- PATCH /api/v1/tenants/:tenantId/appointments/:appointmentId/status
- GET|POST /api/v1/tenants/:tenantId/products
- POST /api/v1/tenants/:tenantId/products/:productId/stock
- GET|POST /api/v1/tenants/:tenantId/transactions
- POST /api/v1/tenants/:tenantId/media/signed-upload
- GET /api/v1/public/tenants/:slug/catalog

JWT Bearer validado contra Supabase Auth en cada petición privada.
Ninguna credencial service_role se entrega al cliente.
Las respuestas actuales son snake_case del backend: el adaptador del front
NO se conectará hasta fase de integración y validación completa.

## Escalado
- Dos instancias stateless API vía Caddy least_conn y un worker outbox.
- Redis: rate limiting global y pubsub por tenant, sin puertos públicos.
- CDN de imágenes: Supabase Storage Smart CDN.
- Reservas: exclusión PostgreSQL por rangos (evita traslapes al mismo tiempo).
- RLS en Supabase para Data API y comprobación explícita por tenant en API.
- pg pool = 8 conexiones por API, optimizar junto con Supabase pooler.

## Seguridad / bloqueos antes de Internet
Validar TLS, backups, rol DB de mínimos privilegios, credenciales,
dominio, E2E, restauración, control de abuso y cuota Storage.
Trabajar desde laptop no ofrece HA física ni protección ante caída de red.


## Módulos añadidos y pruebas de aceptación
- GET/PUT `/api/v1/tenants/:tenantId/barbers/:barberId/hours` (horarios semanales)
- GET/POST `/api/v1/tenants/:tenantId/barbers/:barberId/time-off`
- DELETE `/api/v1/tenants/:tenantId/barbers/:barberId/time-off/:offId`
- GET `/api/v1/public/tenants/:tenantId/availability?barberId=...&serviceId=...&date=YYYY-MM-DD`
- PATCH `/api/v1/me/bookings/:appointmentId/cancel` (hasta 2h antes)
- GET `/api/v1/me/notifications`, PATCH `/api/v1/me/notifications/:notificationId/read`
- GET `/api/v1/public/tenants/:tenantId/barbers/:barberId/rating`
- GET `/api/v1/tenants/:tenantId/reports/overview?from=...&to=...`
- GET `/api/v1/tenants/:tenantId/reports/barbers?from=...&to=...`
- GET `/api/v1/tenants/:tenantId/inventory/low-stock?threshold=5`
- GET/POST `/api/v1/tenants/:tenantId/orders`; PATCH `/.../orders/:orderId/status`
- POST `/api/v1/tenants/:tenantId/reviews`; GET historial de reseñas.
- GET `/api/v1/me/loyalty`; al completar una reserva se acreditan 10 puntos una sola vez.
- GET/POST `/api/v1/tenants/:tenantId/cash-closings`; bloqueo transaccional de movimientos posteriores al cierre.
- GET `/api/v1/public/plans`; GET `/api/v1/tenants/:tenantId/subscription`.

### Pruebas
- `npm run check && npm test` valida sintaxis y tests seguros en CI.
- `$env:RUN_DB_INTEGRATION='1'; node --env-file=.env --env-file=.env.admin.local --test test/integration.test.js` ejecuta tests de integridad SQL contra SOLO el proyecto BarberOS y revierte datos.
- `$env:RUN_LIVE_API_INTEGRATION='1'; node --env-file=.env --env-file=.env.admin.local --test test/live-api.test.js` crea un tenant y un usuario temporal, prueba Auth, horarios, reservas, alertas, notificaciones, inventario, caja y reportes, y los elimina.
- `node scripts/load-smoke.mjs`: ensayo acotado solo desde localhost; **no certifica capacidad de producción**.
- Ver `docs/backend-phases.md` para los criterios de finalización y los bloqueos que todavía faltan.

### Seguridad de conexiones
- API y worker usan PostgreSQL `barberos_backend`, rol sin BYPASSRLS y con privilegios limitados a sus tablas.
- Solo el entorno de prueba en la laptop puede emplear el administrador mediante `backend/.env.admin.local` (archivo ignorado por Git).
- El proyecto se mantiene en `127.0.0.1:8188`; no lo publiques a Internet sin terminar la fase 6.
- No copiar variables `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_PASSWORD` ni credenciales administrativas al frontend o a GitHub.


## Pagos: Wompi seleccionado, desactivado (decisión explícita)

BarberOS funcionará sin Wompi hasta la etapa de producción. No existen llaves
de Wompi, APIs de checkout, webhooks ni cobros reales en línea.

- `GET /api/v1/public/payment-capabilities`: estado efectivo de medios de cobro.
- `GET /api/v1/tenants/:tenantId/orders/:orderId/payments`: estado de pagos manuales y saldo.
- `POST /api/v1/tenants/:tenantId/orders/:orderId/payments/manual`: registro pendiente con `Idempotency-Key`.
- `POST /api/v1/tenants/:tenantId/payments/:paymentId/confirm-manual`: operador registra haber recibido el dinero. La transferencia requiere referencia; en la misma transacción se registra el ingreso en caja.
- `POST /api/v1/tenants/:tenantId/payments/:paymentId/void-pending`: solo anula una anotación que no se ha confirmado.
- Los pedidos con un pago confirmado NO pueden cancelarse sin un flujo de reembolso.
- Los planes tienen `billing_enabled=false` y precios de ejemplo, sin suscripciones cobrables.

**Confirmación manual = constancia del responsable del negocio.** Nunca equivale a
aprobación bancaria. Wompi se reserva EXCLUSIVAMENTE para vender suscripciones
de BarberOS en la futura landing page. NO procesará pedidos ni citas de barberías.

Contrato futuro y criterios de activación:
`docs/wompi-deferred.md`. No añadir credenciales de Wompi al código ni
activar cobros antes de tener un entorno TLS y autorización explícita.

## Nueva funcionalidad: reprogramación segura de citas

- PATCH /api/v1/me/bookings/:appointmentId/reschedule — permite al cliente modificar una cita propia pendiente/confirmada, con 2 horas de anticipación.
- PATCH /api/v1/tenants/:tenantId/appointments/:appointmentId/reschedule — propietario o gerente puede reprogramar una cita del negocio.
- Cuerpo: {"startsAt":"2026-11-05T15:00:00-05:00","barberId":"UUID-opcional"}. Si barberId se omite, se mantiene el barbero original.
- PostgreSQL comprueba disponibilidad, jornada, ausencia y superposición; se registra reschedule_count y notificación al cliente. No se permite mover citas canceladas/completadas.
- La integración Wompi sigue FUERA DE ALCANCE: será únicamente el checkout de planes de BarberOS en la futura landing page, nunca pagos de pedidos/citas de las barberías.
