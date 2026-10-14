# BarberOS — Supabase y GitHub: estado de conexión

## Confirmado y realizado
- Supabase Cloud **BarberOS Backend**, id `wrfwhftzaflwhkvkzrjm`, región us-east-1, plan Free.
- API URL: https://wrfwhftzaflwhkvkzrjm.supabase.co
- Migraciones 001–006 aplicadas; esquema multi-tenant, RLS, Storage y módulos.
- Repo `https://github.com/mivrasas-stack/barberupdate`, rama `main`, commit inicial `16577ae`.
- `backend/.env` local (ignorado por Git): API URL y publishable key configuradas.
- Frontend `src/`, `index.html`, `package.json`, `vite.config.ts`: contenido original sin cambios.
- `barberos_backend` es un rol SQL restringido de acceso NOLOGIN hasta configurar contraseña de forma segura.

## Pendiente para conectar la aplicación Docker con PostgreSQL
Supabase MCP no revela la contraseña privada de Postgres de un proyecto recién creado.
Desde el Dashboard:
1. Abre https://supabase.com/dashboard/project/wrfwhftzaflwhkvkzrjm/settings/database
2. En Database password, configura o restablece una contraseña aleatoria robusta.
3. Pulsa "Connect" en Supabase y copia la URI de **Session pooler** (puerto 5432).
4. En la laptop, editar SOLO `C:\MIVRA PROYECTS\UPDATEBARBER\backend\.env`.
5. Añadir `DATABASE_URL=` con la URI, con contraseña correctamente codificada (URL-encoded).
6. Para firmar subidas de imágenes, copiar una SECRET KEY del proyecto y completar `SUPABASE_SERVICE_ROLE_KEY` SOLO en .env local (nunca en src/ ni Git).
7. Crear una contraseña aleatoria para `REDIS_PASSWORD` en backend/.env.
8. Usar `docker compose --env-file backend/.env -f infra/compose.yaml up -d --build` desde UPDATEBARBER.
9. Verificar: http://127.0.0.1:8188/api/v1/health/live y .../health/ready (debe devolver "ready").
10. No habilitar Internet público hasta TLS, pruebas Auth/Storage, copias y monitoreo.

IMPORTANTE: La URI `postgres` proporciona privilegios de administrador.
Para producción, preferir el rol `barberos_backend`, preparado en la migración 006;
solo después de configurar una contraseña de este rol mediante SQL seguro y confirmar
que admite acceso por el pooler, cambia la URI a su usuario. No habilitar rol API
usando credenciales por defecto ni publicarlas en Git.

## GitHub / Supabase
El repositorio GitHub tiene el código sincronizado, pero esto **no equivale** a la
integración gestionada de GitHub dentro de Supabase. En Supabase > Integrations,
selecciona GitHub y enlaza `mivrasas-stack/barberupdate` si deseas migrations
automáticas. Requiere permisos OAuth/aprobación del propietario en GitHub.
La CI en `.github/workflows/backend-ci.yml` ejecuta validaciones de backend.

## Pendientes funcionales
Integración backend-frontend prohibida hasta completar y validar backend.
Pruebas reales de Auth, Storage, reservas concurrentes, pagos y despliegue;
mediciones p95 y usuarios concurrentes siguen pendientes.
