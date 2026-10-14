# BarberOS — Entrega exprés del backend funcional

**Modalidad:** demostración local de API real, sin exponerla a Internet y sin conectar todavía el frontend.
**Ruta:** `C:\MIVRA PROYECTS\UPDATEBARBER`.
**Repositorio:** https://github.com/mivrasas-stack/barberupdate
**Supabase dedicado:** `wrfwhftzaflwhkvkzrjm`, no utilizar otros proyectos.

## Lo que se entrega

Backend real Fastify + PostgreSQL Supabase + Auth + Storage + Redis + dos réplicas de API + balanceador Caddy + worker, probado en operaciones reales. Incluye aislamiento por barbería, roles, reservas, reprogramación, horarios, ausencias, cierres por día, inventario, pedidos, caja, pagos y devoluciones manuales, reportes, reseñas, puntos y notificaciones con sincronización REST durable.

El código del frontend **no ha sido conectado ni alterado**: en `src/services/apiAdapter.ts` sigue activo `USE_MOCK_ADAPTER = true`. La futura integración requiere adaptar contratos y JWT; ver `docs/frontend-backend-integration-contract.md`.

**Wompi desactivado:** se usará solo para vender suscripciones BarberOS desde una landing page futura, nunca para cobrar servicios de barbería.

## Demostración en Windows en pocos minutos

### 1. Abrir PowerShell en el proyecto

```powershell
Set-Location 'C:\MIVRA PROYECTS\UPDATEBARBER'
```

### 2. Comprobar e iniciar solo los servicios de BarberOS

```powershell
docker compose --env-file backend/.env -f infra/compose.yaml up -d --build
docker compose --env-file backend/.env -f infra/compose.yaml ps
```

No reiniciar Docker Desktop ni otros contenedores. Se requieren Docker Desktop activo y `backend/.env` configurado (ya presente solo en la laptop autorizada).

### 3. Comprobar que la API está viva

Abrir en un navegador:

- http://127.0.0.1:8188/api/v1/health/live
- http://127.0.0.1:8188/api/v1/health/ready
- http://127.0.0.1:8188/api/v1/public/plans
- http://127.0.0.1:8188/api/v1/public/payment-capabilities

La respuesta `ready` debe contener `"status":"ready"`. Wompi debe continuar `enabled:false` en `platformBilling`.

### 4. Ejecutar batería automática de entrega

```powershell
Set-Location 'C:\MIVRA PROYECTS\UPDATEBARBER\backend'
npm run verify:delivery
```

Esto comprueba sintaxis de entrada, todos los tests locales y vulnerabilidades altas/críticas de producción. La última batería local tenía **22 pruebas aprobadas y 4 suites integrales opt-in omitidas por defecto**.

### 5. Verificar de extremo a extremo (crea y elimina datos de prueba)

```powershell
Set-Location 'C:\MIVRA PROYECTS\UPDATEBARBER\backend'
npm run verify:delivery -- --live
```

Requiere `backend/.env.admin.local` ignorado por Git, más servicios Docker activos. Comprueba SQL con ROLLBACK, autenticación Supabase, usuarios y dos barberías temporales, reservas, inventario, pagos/devoluciones, caja, reportes, imágenes firmadas, restricciones entre roles y concurrencia. Las pruebas eliminan sus usuarios, imágenes y empresas temporales en `finally`.

Opcional: `npm run verify:delivery -- --live --smoke` agrega 450 consultas HTTP locales. No ejecutar repetidamente o contra tenants reales por cuotas de Supabase.

La prueba independiente `RUN_LIVE_REALTIME=1 ... test/realtime.test.js` **no debe presentarse como aprobada**, pues ha fallado en ejecuciones recientes. Las notificaciones se recuperan mediante `GET /api/v1/me/notifications/sync`; la conexión WebSocket es opcional y debe manejar reconexión/polling cuando se integre el frontend.

### 6. Verificar límites de la entrega

```powershell
node scripts/health-monitor.mjs
node --env-file=.env scripts/production-preflight.mjs
```

`production-preflight` **debe devolver `ready:false` en la laptop**. Esto es correcto: el backend puede demostrarse localmente, pero aún no existe dominio público, alojamiento 24/7, certificados HTTPS reales, alertas ni restauración integral de Auth/Storage.

## Endpoints para evaluación

| Módulo | Endpoint de ejemplo |
|---|---|
| Salud del sistema | `GET /api/v1/health/ready` |
| Planes SaaS públicos | `GET /api/v1/public/plans` |
| Identidad | `GET /api/v1/me` |
| Empresas | `GET /api/v1/tenants` |
| Barberos y servicios | `GET /api/v1/tenants/:tenantId/barbers`, `/services` |
| Disponibilidad | `GET /api/v1/public/tenants/:tenantId/availability` |
| Reservar | `POST /api/v1/tenants/:tenantId/bookings` |
| Horarios y cierres | `/api/v1/tenants/:tenantId/barbers/:barberId/hours`, `/closed-days` |
| Pedidos y productos | `/api/v1/tenants/:tenantId/orders`, `/products` |
| Pagos del negocio | `/api/v1/tenants/:tenantId/orders/:orderId/payments` |
| Devoluciones manuales | `POST /api/v1/tenants/:tenantId/payments/:paymentId/refund-manual` |
| Informes | `GET /api/v1/tenants/:tenantId/reports/overview` |
| Notificaciones recuperables | `GET /api/v1/me/notifications/sync` |

Las rutas privadas requieren JWT de Supabase y privilegios adecuados. Las operaciones que pueden duplicarse requieren `Idempotency-Key`.

## Qué está fuera de esta entrega local

- Conexión del frontend, porque se pidió mantenerlo intacto.
- Hosting 24/7, dominio, TLS público, monitor externo y alertas reales.
- Restauración integral de credenciales/sesiones de Auth y de objetos Storage, y backups durables automatizados.
- Validación sostenida de 1000 sesiones y auditoría externa de penetración.
- Wompi para suscripciones de BarberOS en la futura landing page.
- Reglas tributarias, comisiones liquidadas y proveedores externos de SMS/correo no especificados.

**Conclusión para presentación:** el backend es una implementación funcional de API local con pruebas reales; no afirmar que la interfaz ya esté conectada ni que la infraestructura de producción esté al 100%. El informe técnico de resultados y bloqueos está en `docs/informe-cierre-backend.md`.
