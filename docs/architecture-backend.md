# BarberOS - Arquitectura Backend (sin tocar frontend)
Ruta única: C:\MIVRA PROYECTS\UPDATEBARBER

## Implementación
- backend/: servicio Fastify, auth contra Supabase Auth, validación, API multiempresa,
  reservas, inventario, contabilidad básica, permisos, imágenes y worker outbox.
- supabase/migrations/: SQL exclusivo para un NUEVO proyecto Supabase BarberOS.
- infra/: 2 réplicas de API, Caddy como balanceador least_conn, Redis persistente y worker.
- src/, index.html, package.json y vite.config.ts del frontend: INTACTOS.

## Diagrama lógico
Cliente React (actualmente mock, aún sin integrar)
  -> CDN frontend (futuro)
  -> Caddy /api/* (TLS por proxy perimetral en producción)
    -> Fastify API 1 / Fastify API 2
      -> Supabase Auth (JWT verificado con getUser)
      -> Supabase PostgreSQL (tablas tenant_id; RLS Data API; reservas EXCLUDE gist)
      -> Redis (rate limit global, pub/sub, workers)
      -> Supabase Storage Smart CDN (bucket público de imágenes)
  -> Supabase Realtime Postgres Changes (canales autenticados con RLS)
Worker outbox -> Redis pub/sub; entregas al menos una vez (consumidor deduplica eventId).

## Decisión: monolito modular antes que microservicios
Despliegue separado API/worker; límites de dominio claros. Microservicios solo cuando
la carga, equipos, o necesidad de independencia funcional lo justifiquen. Evita transacciones
distribuidas prematuras. Dos réplicas ofrecen redundancia parcial, no alta disponibilidad
ante la caída de la única laptop, Redis único o Supabase.

## Multitenancy
- Shared database, tenant_id en datos de negocios.
- FKs compuestas impiden mezclar entidades de empresas diferentes.
- Endpoints privados verifican usuario y membresía/rol, incluso con URL alterada.
- Supabase Data API: SELECT con RLS según auth.uid(); mutaciones directas revocadas.
- En producción usar rol SQL dedicado de mínimos privilegios; no exponer connection
  string ni claves service_role en el navegador.
- Clientes autenticados pueden reservar sin ser miembros, usando su propio auth.uid().
- Cada reserva requiere Idempotency-Key. PostgreSQL excluye rangos de tiempo traslapados.

## SLO / capacidad: objetivos de diseño, NO mediciones
- 200 solicitudes/segundo sostenidas / 500 ráfaga (objetivo a validar con k6).
- 1,000 sesiones conectadas, no equivale a 1,000 RPS.
- p95 GET <= 250 ms; p95 POST reserva <= 500 ms en backend, sin internet/CDN.
- Tasa 5xx < 0.5% y ningún doble agendamiento bajo carga; prueba pendiente.
- 1,000 negocios x 5 barberos x 8 citas/día = 40,000 citas/día,
  ~14.6 millones/año: estimar 1-3 KB/index/cita = ~15-45 GB/año
  sin imágenes ni copias de respaldo. Dimensionar tablas, retención y plan.

## Crecimiento
1) Índices, pooler Supabase, pool máx 8 por réplica (16 conexiones API + worker).
2) Redis para rate limit, consultas públicas de catálogos cacheables (aún pendiente).
3) Escalar réplicas API, worker separado, colas idempotentes, pruebas de carga k6.
4) Realtime y Storage gestionados por Supabase; verificar cuotas/conexiones del plan.
5) Particionado por fecha de citas históricas y réplica de lectura cuando métricas lo exijan.

## Operación
No hay un proyecto Supabase nombrado BarberOS en la conexión actual. NO se modifican
proyectos Supabase de otras apps. Configurar uno dedicado y completar backend/.env
(secrets solo servidor). Ejecutar migraciones de supabase/migrations en orden, activar
realtime y Storage, configurar endpoints/keys, luego levantar infra/compose.yaml.
NO desplegar en internet hasta tener TLS, pruebas E2E, migración y backup verificados.
Usar backups/PITR de Supabase conforme al plan, monitoreo y alertas.

## Brechas actuales (no presentar como producto terminado)
Falta proyecto Supabase dedicado y credenciales; no se ha probado un entorno
Supabase remoto, Auth ni Storage. Faltan pagos reales, suscripciones, punto de venta
con órdenes atómicas, notificaciones externas, E2E y benchmarking con tráfico real.
Ningún cambio o conexión con el frontend se hace antes del cierre de esos hitos.
