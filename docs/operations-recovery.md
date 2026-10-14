# BarberOS — supervisión, resiliencia y recuperación

Proyecto exclusivo: BarberOS Backend, Supabase `wrfwhftzaflwhkvkzrjm`.
Entorno de verificación: laptop autorizada, `C:\MIVRA PROYECTS\UPDATEBARBER`.
Frontend y contenedores ajenos: fuera de alcance; no modificarlos.

## Sondas implementadas

- `GET /api/v1/health/live`: el proceso Node funciona; NO es señal de servicio completo.
- `GET /api/v1/health/ready`: comprueba una consulta a PostgreSQL y Redis PING; devuelve 503 si alguno falla.
- Caddy utiliza `/health/ready` en ambas réplicas, comprueba cada 10 s, marca fallos y reintenta otra réplica. Caddy solo escucha en localhost.
- `backend/scripts/health-monitor.mjs`: sonda ejecutable (una sola vez por invocación). Comprueba readiness, catálogo de planes y Wompi desactivado, emite JSON con latencias y termina con código de salida 1 si algo falla.

Uso desde `UPDATEBARBER\backend`:

```powershell
node scripts/health-monitor.mjs
# Opcional para futuro entorno HTTPS:
$env:HEALTH_BASE_URL='https://api.example.com'
node scripts/health-monitor.mjs
Remove-Item Env:HEALTH_BASE_URL
```

El script rechaza URL HTTP remotas y URL con credenciales. No expone contraseñas.
**Todavía no está conectado a un programador, central de métricas, ni servicio de alertas.**
Para supervisión en producción, ejecutarlo cada minuto desde un monitor externo, registrar resultados y configurar canales de alerta reales.

## Prueba de caída parcial realizada

- Caddy validado y reiniciado solo dentro del stack `barberos-updatebackend`.
- Se comprobó HTTP 200 antes del ensayo.
- Se detuvo únicamente la réplica `api1` de BarberOS, sin afectar Redis, PostgreSQL, otros proyectos ni la réplica `api2`.
- Durante la caída: 14/14 consultas HTTP a `/api/v1/health/ready` devolvieron HTTP 200 por el balanceador; 0 errores.
- En bloque `finally` se restauró `api1` y se confirmó estado ejecutándose para las dos APIs, worker, Caddy y Redis saludable; la API volvió a HTTP 200.
- **Alcance limitado:** demuestra conmutación básica entre las dos réplicas locales. No demuestra recuperación ante pérdida de host, Redis, PostgreSQL, conexión con Supabase ni 1000 clientes concurrentes.

## Respuesta a incidentes: seguir este orden

1. Desde la laptop autorizada, ejecutar `node backend/scripts/health-monitor.mjs` (entrando primero en `backend`). No enviar valores de .env ni encabezados Authorization a un tercero.
2. Inspeccionar **solo** contenedores del proyecto con `docker compose --env-file backend/.env -f infra/compose.yaml ps` desde el directorio raíz de BarberOS.
3. Inspeccionar logs **solo de BarberOS** con `docker compose --env-file backend/.env -f infra/compose.yaml logs --tail 60 api1 api2 worker lb redis`, filtrando previamente tokens/PII. No compartir logs sin revisarlos.
4. Si falla una sola réplica, verificar que la otra responde. Recuperar exclusivamente el servicio afectado; no reiniciar Docker Desktop ni contenedores de otros proyectos.
5. Si falla Redis, la API debe rechazar solicitudes sujetas al rate limit y el endpoint ready debe quedar no disponible; comprobar el volumen persistente antes de reiniciar ese servicio.
6. Si falla Supabase, revisar el panel y estado de red/conexiones antes de cualquier intervención. No usar credenciales admin en contenedores.
7. Antes de corregir migraciones o restaurar datos, elaborar una copia consistente, identificar la versión del esquema y ensayar en **una base aislada**. No hacer pruebas destructivas contra el proyecto Cloud real.

## Backups y restauración: NO APROBADOS TODAVÍA

- El almacenamiento de Supabase incluye base Postgres, Auth y Storage: protegerlos por separado, con cifrado, rotación y permisos mínimos.
- No se ha probado aún una copia **completa** seguida de restauración a un nuevo proyecto aislado. No declarar RPO/RTO ni recuperación ante desastres.
- Las opciones de backups gestionados varían por plan Supabase; no asumir que Free provee backups automáticos suficientes para producción.
- Antes de producción: elegir política de retención, horario de snapshots, responsable de custodia, cifrado y destino independiente de la laptop.
- Crear una base nueva aislada, restaurar una copia con datos ficticios y ejecutar comprobaciones de esquema, RLS, Storage y Auth. Documentar mediciones RPO/RTO reales.
- Nunca colocar credenciales de `backend/.env`, `backend/.env.admin.local` ni archivos de backup en GitHub.

## Pendiente de aprobación antes de producción

- Monitor remoto automático, trazas, agregación central de logs y notificaciones de alertas.
- Pruebas de desconexión/reconexión Redis y Realtime a largo plazo, reinicios de host y recuperación completa de datos.
- Prueba de carga de reservas/pedidos con métricas p95 y 1000 sesiones conforme a un objetivo acordado.
- Despliegue HTTPS con dominio, secretos gestionados, límites de servicio, backups y restauración auditados.
- Wompi **únicamente** para cobro futuro de planes BarberOS desde la landing page, después de terminar el backend; no para cobrar servicios o pedidos de barberías.
