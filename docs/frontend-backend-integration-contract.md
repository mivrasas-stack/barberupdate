# BarberOS — contrato de integración frontend/backend

**Estado:** DOCUMENTACIÓN SOLAMENTE. No hay cambios en el frontend ni conexión real.
**Proyecto:** C:\MIVRA PROYECTS\UPDATEBARBER. **API actual:** http://127.0.0.1:8188.

## Comprobación de frontend actual

El archivo protegido `src/services/apiAdapter.ts` contiene `USE_MOCK_ADAPTER = true`. En ese modo, la interfaz trabaja contra `barberStore` (almacenamiento de demostración). La clase HTTP existe como stub, pero aún no mapea los recursos ni envía JWT de Supabase al backend. Cambiar un único booleano no completa la integración.

**No cambiar `src/`, `index.html`, `package.json` raíz ni `vite.config.ts` hasta autorización expresa.**

## Contratos del backend para la futura integración

| Función UI | Recurso API | Autenticación |
|---|---|---|
| Sesión de usuario | Supabase Auth; `GET /api/v1/me` | JWT |
| Barberías propias | `GET /api/v1/tenants` | JWT |
| Catálogo público | `GET /api/v1/public/tenants/:slug/catalog` | Pública |
| Horarios y disponibilidad | `GET /api/v1/public/tenants/:tenantId/availability?barberId=...&serviceId=...&date=YYYY-MM-DD` | Pública |
| Crear reserva | `POST /api/v1/tenants/:tenantId/bookings` | JWT, Idempotency-Key |
| Mis citas | `GET /api/v1/me/bookings` | JWT |
| Citas del negocio | `GET /api/v1/tenants/:tenantId/appointments?start=...&end=...` | JWT, rol autorizado |
| Ausencias/cierres | `/api/v1/tenants/:tenantId/barbers/:barberId/time-off`; `/api/v1/tenants/:tenantId/closed-days` | JWT, propietario/gerente para escribir |
| Productos/stock | `/api/v1/tenants/:tenantId/products` | JWT, rol autorizado |
| Pedidos | `/api/v1/tenants/:tenantId/orders` | JWT |
| Cobros/devoluciones manuales | `/api/v1/tenants/:tenantId/orders/:orderId/payments`, `/api/v1/tenants/:tenantId/payments/:paymentId/refund-manual` | JWT, propietario/gerente para escribir |
| Historial/recuperación de notificaciones | `GET /api/v1/me/notifications/sync?cursor=...&limit=50` | JWT |
| Planes SaaS | `GET /api/v1/public/plans` | Pública |
| Capacidades de pago | `GET /api/v1/public/payment-capabilities` | Pública |

## Condiciones de integración

- La API usa nombres `snake_case` en respuestas PostgreSQL y `camelCase` en cuerpos de algunas solicitudes. Definir conversiones bidireccionales explícitas para los modelos visuales.
- Enviar `Authorization: Bearer <JWT Supabase de usuario>`; nunca llevar `SUPABASE_SERVICE_ROLE_KEY` ni credenciales PostgreSQL al navegador.
- En operaciones de creación susceptibles de duplicación, enviar `Idempotency-Key` único y estable durante reintentos.
- Las listas/fechas deben conservar zona horaria `America/Bogota` o la configurada en cada barbería. No construir horas utilizando solo UTC del dispositivo.
- Realtime no ofrece garantía de entrega de cada evento. Al iniciar sesión, al reconectar y periódicamente, consumir `/notifications/sync` hasta `hasMore=false`; persistir el cursor confirmado y eliminar duplicados por ID.
- Probar CORS en el origen web elegido; el API de desarrollo permanece solo en localhost. No abrir 8188 públicamente.
- Todas las operaciones de empresa deben usar tenantId de la sesión autorizada; el frontend no decide privilegios.
- Wompi no se conecta aquí: solo más adelante en la landing page para vender suscripciones/licencias BarberOS.
- Pruebas imprescindibles al conectar: inicio/cierre de sesión, 401/403, separación entre barberías, agenda + reprogramación, venta/stock, reversos manuales, conexión perdida y sincronización de notificaciones.

No se considera frontend integrado hasta verificar estos flujos en la aplicación real y obtener autorización para modificarla.

## Estado posterior a este documento

La capa principal de sesión/servicios se conectó en la laptop en modo `VITE_BACKEND_MODE=live` sin cambiar el diseño visual. Los pasos vigentes y el alcance probado se documentan en `docs/FRONTEND-CONEXION-REAL.md`. Algunos módulos del contrato permanecen pendientes; los requisitos de producción siguen siendo independientes.


## ACTUALIZACION: integracion realizada y probada

La antigua seccion de estado previo describia el frontend en modo mock. Desde la integracion de octubre 2026, el modo conectado se activa mediante .env.local ignorado por Git; la API local y Supabase Auth estan conectados para los flujos verificados. BarberOS se presenta por http://127.0.0.1:3199 (el puerto 3000 corresponde a otra aplicacion). Ver docs/REPORTE-VALIDACION-PLAYWRIGHT.md. Quedan sin integrar funciones visuales que requieren rutas o reglas comerciales adicionales; Wompi no esta activado.
