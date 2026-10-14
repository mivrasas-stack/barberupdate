# BarberOS — condiciones de salida a producción

Estado actual: **NO AUTORIZADO PARA LANZAMIENTO**. Esta guía prepara
la fase 6 sin publicar la API ni modificar el frontend.

Repositorio: https://github.com/mivrasas-stack/barberupdate
Instalación de desarrollo: LAPTOP-TT7C3PL5,
C:\MIVRA PROYECTS\UPDATEBARBER.
Supabase exclusivo: wrfwhftzaflwhkvkzrjm.
Todos los cambios deben permanecer en backend/, infra/, supabase/ y docs/.

## Lo que existe y está probado

- API Fastify con dos réplicas, Redis protegido, worker y Caddy local.
- Supabase Auth/PostgreSQL/Storage y notificaciones por Realtime con aislamiento.
- Conmutación parcial entre réplicas (14/14 respuestas HTTP 200).
- Redis desconectado: 6/6 solicitudes del endpoint ready informaron
  indisponibilidad; después de recuperar Redis, ready volvió a HTTP 200.
- Diez operaciones de reserva bajo cinco solicitudes concurrentes sobre un
  tenant temporal aislado: 10 HTTP 201; p95 = 2001 ms. Es una muestra pequeña.
- Sonda ejecutable backend/scripts/health-monitor.mjs con tres comprobaciones
  y exit code no cero ante fallo.
- Archivo de ejemplo infra/caddy/Caddyfile.production.example validado
  con Caddy aislado y variables ficticias. **No es el archivo desplegado.**
- La sonda backend/scripts/production-preflight.mjs comprueba indicadores
  mínimos de configuración; falló intencionadamente con el entorno local.
  Sus variables de aprobación son declaraciones humanas, NO sustituyen
  una auditoría de seguridad, una restauración verificada ni las alertas.

## Puertas que faltan antes de publicar

- [ ] Dominios y DNS aprobados, certificado TLS válido y red perimetral.
- [ ] Entorno 24/7 distinto a esta laptop, acceso restringido y secret manager.
- [ ] Configuración CORS HTTPS estricta para la landing y la app autorizadas.
- [ ] Límites de recursos y número de conexiones calculados para el plan real
  de Supabase, Redis y carga esperada.
- [ ] Optimizar p95 de creación de reservas y repetir prueba con suficientes
  datos, duración sostenida y clientes distribuidos.
- [ ] Validación de caída de PostgreSQL/Supabase y recuperación de conectividad.
- [ ] **Backup completo de Postgres, Auth y Storage y restauración ensayada**
  en un entorno distinto; RPO/RTO documentados; ninguna copia en Git.
- [ ] Monitor remoto programado, logs protegidos, alertas verificadas con
  una falla simulada y equipo de guardia.
- [ ] Revisión de seguridad y privacidad (incluido proxy/IP y rate limit
  de visitantes anónimos), prueba de penetración y análisis de dependencias.
- [ ] Verificación de permisos de todos los roles y de conciliación de caja,
  cancelaciones, reembolsos y reglas comerciales.
- [ ] Escoger proveedor de correo/SMS/push si el producto requiere entrega
  externa, y establecer consentimiento, privacidad y tiempos de entrega.
- [ ] Aprobación del usuario para conectar el frontend y luego desplegar.

## Cómo preparar el despliegue cuando se autorice

El archivo infra/caddy/Caddyfile.production.example contiene una
configuración de ejemplo que usará las variables BARBEROS_API_DOMAIN y
ACME_EMAIL para HTTPS automático. **No se debe apuntar un dominio real
ni abrir los puertos 80/443 hasta verificar los requisitos anteriores.**

El servidor de producción deberá tener su propia configuración Compose
y volúmenes persistentes para certificados, monitor externo, políticas
de backups y datos. El compose actual sigue vinculado a 127.0.0.1:8188.
No modificarlo para exposición pública sin autorización explícita.

La verificación de configuración que debe fallar en desarrollo:

PowerShell (dentro de backend):
    node --env-file=.env scripts/production-preflight.mjs

Solo un proceso de lanzamiento controlado, después de pasar las
verificaciones reales, deberá establecer las declaraciones:
BARBEROS_PRODUCTION_APPROVED=true,
BARBEROS_BACKUP_RESTORE_VERIFIED=true,
BARBEROS_ALERTS_VERIFIED=true y
BARBEROS_SECURITY_REVIEW_VERIFIED=true,
además de BARBEROS_PUBLIC_API_URL=https://...,
BARBEROS_API_DOMAIN=... y CORS_ORIGINS=https://....

**No basta con cambiar estas variables para estar listo para producción.**
Las pruebas y la autorización externa se deben documentar.

## Wompi

Por decisión del propietario, Wompi será EXCLUSIVAMENTE para vender
suscripciones/licencias BarberOS desde la futura landing page.
Nunca para cobrar citas ni pedidos de las barberías. La integración
y la landing page siguen pendientes hasta que el backend esté terminado,
sin keys, webhooks ni cobros online activados.

Más información: docs/backend-phases.md, docs/backend-test-results.md,
docs/operations-recovery.md y docs/wompi-deferred.md.

## Restauracion parcial ensayada

- El proyecto actual (PostgreSQL 17) pudo exportar/restaurar el esquema
  public mediante streaming TLS a un contenedor local temporal sin red;
  se comprobaron 22 tablas, 22 RLS, 3 planes, 12 triggers y 44 policies.
- No se preservo un backup durable y NO se ha restaurado Auth ni Storage.
- El tiempo 19 s no es un RTO completo. Las casillas de backup integral,
  alta disponibilidad y autorizacion para lanzamiento siguen pendientes.
- El backend usa ahora un unico proxy Caddy confiable para IP por cliente
  anonimo; si se agrega un proxy/CDN, revisar la politica de confianza.
