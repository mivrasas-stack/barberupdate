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
