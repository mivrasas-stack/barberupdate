# Centro de Integraciones — Barber Paradise

La nueva ruta de Superadmin es **/admin/integraciones**. Incluye WhatsApp Cloud API, correos Resend y OpenAI.

## Qué permite
- **WhatsApp:** guardar Phone Number ID, versión Graph, token permanente, App Secret y token de verificación; comprobar credenciales de Graph sin enviar mensajes. El worker y el webhook usan las claves del centro de integraciones cuando están configuradas.
- **Resend:** guardar API Key y remitente verificado; enviar una prueba exclusivamente al email autenticado del Superadmin. Las automatizaciones de correos todavía requieren conexión con los eventos del negocio.
- **OpenAI:** guardar API Key, modelo e instrucciones y probar acceso al modelo. **No crea ni publica un bot por sí solo**: las reglas de conversación y sus endpoints se agregan según el caso de uso.

Todas las operaciones del panel verifican `public.platform_admins` en el backend. El frontend jamás almacena secretos en almacenamiento del navegador; los campos quedan vacíos tras guardar. Las claves se cifran con AES-256-GCM, IV aleatorio y autenticación GCM. La API solo devuelve indicadores de presencia.

## Configuración inicial del servidor

Antes de abrir el panel con datos reales, generar una clave maestra mediante PowerShell:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Guardar en el archivo privado **UPDATEBARBER/backend/.env**, utilizado por Docker Compose:

```dotenv
PLATFORM_SECRETS_KEY=EL_VALOR_ALEATORIO_GENERADO
WHATSAPP_SEND_ENABLED=false
```

No subir la clave a GitHub y no colocarla en `VITE_*`. Mantener la **misma clave maestra** en todos los contenedores API y worker. Una pérdida o cambio sin descifrar y volver a cifrar imposibilita recuperar las claves anteriores.

Aplicar la migración `supabase/migrations/20261014000500_platform_integrations.sql` en **staging aislado** tras revisión, antes de desplegar el backend. La migración requiere el rol de PostgreSQL `barberos_backend` de las migraciones previas.

## Preparación para producción

1. Revisar PR de WhatsApp #3 y después esta PR dependiente. Ejecutar pruebas backend y compilación frontend.
2. Aplicar primero las migraciones en staging y comprobar con un usuario no admin que los endpoints devuelvan 403.
3. Desplegar backend y frontend juntos, detrás de HTTPS estable, y pasar `PLATFORM_SECRETS_KEY` a Docker.
4. Abrir el Centro de Integraciones en modo conectado y pegar credenciales de cada proveedor. Usar **Probar conexión**.
5. Registrar `https://TU-API/api/v1/whatsapp/webhook` en Meta y suscribir `messages`. Publicar la aplicación y usar plantillas aprobadas.
6. Validar consentimiento del cliente, reintentos, callbacks, permisos, recuperación y auditoría antes de permitir envíos en producción.
7. `WHATSAPP_SEND_ENABLED=true` es una **última decisión consciente** después del despliegue. Habilitar también el proveedor en el panel y la barbería individual. Nunca habilitar envíos en pruebas.

Los túneles rápidos `trycloudflare.com` son temporales y no son un endpoint de producción. La funcionalidad aquí se entrega como código en una rama, **no** como cambio aplicado al Docker local ni a la base de datos.
