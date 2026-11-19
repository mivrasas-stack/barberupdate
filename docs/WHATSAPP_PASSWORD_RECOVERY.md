# BarberNow — restablecimiento por WhatsApp (implementación transitoria)

**Objetivo:** restablecer una contraseña después de validar el código de `barbernow_codigo_acceso` en el celular asociado a la cuenta, sin pedir `+57` y sin enviar correos.

## Flujo
1. El usuario escribe el correo usado al iniciar sesión.
2. El servidor resuelve el celular **únicamente desde la cuenta existente**. Nunca acepta un número aportado durante la recuperación.
3. Si hay un celular colombiano válido, único entre cuentas, Meta recibe la plantilla AUTHENTICATION `barbernow_codigo_acceso` (idioma `es`) con código de ocho dígitos.
4. El código expira en 5 minutos, queda como HMAC-SHA256 en el PostgreSQL local, admite cinco intentos y solo se usa una vez.
5. Tras validarlo, el cliente recibe un token temporal de restablecimiento de cinco minutos, no una sesión de usuario.
6. La contraseña nueva tiene **mínimo 6 caracteres**, máximo 128. Se confirma en un segundo campo con botón para mostrar/ocultar.
7. La actualización final usa **temporalmente el proveedor de identidades que sigue activo en producción**. No se modifican las tablas comerciales de ese proveedor.

## Seguridad y dependencia temporal
- Todas las tablas de desafíos se guardan solo en el PostgreSQL del contenedor `barbernow-db-postgres`; no se crean tablas de OTP en la base anterior.
- Producción aún utiliza la autenticación antigua; el corte hacia la autenticación 100% propia es otro proyecto pendiente. No afirmar lo contrario.
- No se cambian números ni contraseñas de usuarios existentes durante el despliegue.
- Evitar revelar qué correos existen, cuáles tienen celular o cuál es el número: la respuesta de solicitud es genérica.
- No habilitar el flujo si falta la conexión privada `RECOVERY_DATABASE_URL` o un secreto aleatorio de 32 bytes `RECOVERY_OTP_SECRET` en el servidor.
- El número registrado en metadatos antiguos no necesariamente fue verificado. El usuario lo verifica al ingresar el OTP, pero un número reutilizado o compartido presenta riesgos. Bloqueo preventivo de números compartidos.
- Los usuarios sin teléfono válido registrado no reciben OTP; requieren recuperación asistida segura o registrar y verificar teléfono desde una sesión existente.
- El aceptado por Meta no significa entregado: los webhooks de entrega son relevantes para diagnosticar incidencias.
- Después de resetear la contraseña se requiere un inicio de sesión nuevo.
- La política de mínimo 6 es la solicitada por producto; contraseñas largas y únicas siguen siendo recomendadas.

## Despliegue y validación
- PR de código aislado: actualizar API1, API2 y web de forma coordinada, no solo la web.
- Crear la tabla con `infra/postgres/003_legacy_whatsapp_password_recovery.sql` en la base `barbernow` del PostgreSQL local.
- Validar una entrega y un cambio de clave real **únicamente en una cuenta de prueba propia**; jamás sobre cuentas de clientes ajenos.
- Confirmar que la aplicación sigue mostrando reservas, QR y permisos tras el cambio.