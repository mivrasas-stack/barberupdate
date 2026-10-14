# BarberOS — arquitectura real del backend (entrega local)

**Proyecto único:** `C:\MIVRA PROYECTS\UPDATEBARBER`.
**Supabase dedicado y operativo:** `wrfwhftzaflwhkvkzrjm`.
**Repositorio:** https://github.com/mivrasas-stack/barberupdate

## Estado comprobado

El backend está implementado, probado y ejecutándose localmente, con dos
instancias API Fastify, Caddy, Redis persistente y un worker de eventos.
Caddy publica la API **solo en 127.0.0.1:8188**: no está en un servidor público.

El frontend React original permanece intacto, con `USE_MOCK_ADAPTER = true`.
**La interfaz aún NO consume los datos del backend**. La integración posterior
requerirá JWT de Supabase, mapeo de modelos y revisión de las rutas; ver
`docs/frontend-backend-integration-contract.md`.

## Diagrama de ejecución

```text
Clientes de prueba HTTP (API real en localhost)
     |
127.0.0.1:8188 — Caddy (health checks de dependencias)
     |                  |
 Fastify API 1      Fastify API 2      worker de outbox
     |                  |                     |
     +------- Redis rate-limit y pub/sub -----+
     |
     +--- Supabase Auth: validación de JWT
     +--- Supabase PostgreSQL: tenant_id, RLS, exclusión de reservas
     +--- Supabase Storage: subida firmada de imágenes por empresa
     +--- Supabase Realtime: eventos WebSocket opcionales
     +--- API REST /me/notifications/sync: recuperación durable
```

El frontend React usa actualmente sus datos mock; se conectará solo
cuando el propietario autorice modificarlo. La venta SaaS por Wompi se
integrará posteriormente desde otra landing page.

## Módulos del backend

- Usuarios: Supabase Auth, identificación de sesión y roles owner/manager/barber;
  propietario y tenant protegidos ante cambio de empresa.
- Agenda: servicios, barberos, horarios y descansos, ausencias, cierres
  excepcionales, disponibilidad, reservas, reprogramaciones, cancelaciones,
  notificaciones y fidelización.
- Operaciones: productos, inventario atómico, pedidos, cobros offline con
  confirmación humana, devoluciones offline, caja y cierre diario, reseñas,
  informes y comisiones estimadas.
- Seguridad: rol SQL limitado `barberos_backend` sin BYPASSRLS, políticas
  de acceso Supabase, validación de entradas, idempotencia, proxy confiable
  y Redis como limitador transversal. Los secretos no pertenecen al frontend.
- Resiliencia: dos réplicas detrás de Caddy, fallas de Redis detectadas,
  worker outbox, monitor local y restauración de PostgreSQL público
  en contenedor temporal aislado.

## Comprobaciones de aceptación

- `npm run check`, `npm test` y
  `npm run verify:delivery -- --live` desde backend/.
- SQL: 16 migraciones aplicadas, 24 tablas públicas y RLS en las 24.
- E2E: autenticación, multiempresa, inventario, pagos manuales,
  devoluciones, reportes, cierres, Storage, concurrencia y rollback.
- Recuperación actual del esquema público: 24 tablas, 16 triggers,
  48 políticas, tres planes. No constituye backup integral de Auth/Storage.
- Test local de lectura acotada: 450 HTTP 200/450. No avala 1000 sesiones
  activas ni garantiza SLA en servidores de producción.

## Limitaciones y salida a producción

- WebSocket Realtime ha sido intermitente en varias pruebas; la entrega
  confiable de notificaciones depende de la sincronización REST con cursor
  y de que el futuro frontend la utilice.
- Supabase Auth y Storage reales requieren estrategia de backup, restauración
  completa y ensayos de recuperación independientes.
- Un único PC, Redis y proyecto Supabase siguen siendo puntos compartidos
  de fallo; doble API no equivale a disponibilidad total.
- No hay dominio, HTTPS público, hosting 24/7, alertas externas verificadas
  ni auditoría externa de penetración.
- Correo/SMS/push externos, legislación fiscal y liquidación real de
  comisiones requieren decisiones/proveedores aún no definidos.
- **Wompi permanecerá desconectado:** solo para comercializar suscripciones
  a BarberOS en la futura landing page, no para cobrar a los clientes
  de cada barbería.

Esta arquitectura refleja el estado real del código; el archivo
`docs/ENTREGA-BACKEND.md` contiene las instrucciones cortas para entregar
y demostrar el backend ahora.
