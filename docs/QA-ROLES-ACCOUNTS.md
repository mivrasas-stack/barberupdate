# BarberOS — cuatro perfiles de prueba y permisos

## Estado de las cuentas

Las cuatro cuentas **NO han sido creadas todavía**. Las herramientas bloquearon el alta automática de identidades privilegiadas en Supabase Auth. No se inventaron correos, contraseñas ni identidades; tampoco se modificaron los 4 usuarios existentes del proyecto.

La API y la base de datos sí cuentan con las distinciones necesarias para asignar y verificar correctamente los perfiles.

## Matriz de permisos reales

| Perfil | Identidad de autorización | Accesos previstos y verificados por backend |
| --- | --- | --- |
| Superadmin | Registro explícito del UID en `public.platform_admins`, solo administrable con credenciales privilegiadas | `GET /api/v1/me` devuelve `platformRole: "superadmin"`; `GET /api/v1/platform/tenants` permite listar empresas globales. **No obtiene automáticamente acceso a los datos privados de una empresa**. |
| Barbería (dueño) | `tenant_members.role = 'owner'`, con `tenants.business_kind = 'barbershop'` | Puede administrar servicios, productos, inventario, personal, agenda, pedidos y caja exclusivamente de **su empresa**, conforme a las rutas existentes. No tiene permiso global. |
| Barbero independiente | Propietario de una empresa propia con `tenants.business_kind = 'independent'` y barbero vinculado a su `auth.uid` | Accede a `/barbero/<slug>/inicio` y gestiona su espacio profesional; no accede a otras barberías. La base de datos mantiene el mismo control propietario por tenant. |
| Cliente | Usuario Supabase Auth sin membresías empresariales | Puede consultar catálogo público, reservar y acceder únicamente a sus propias reservas y pedidos. Prohibido consultar o modificar datos internos de barberías y el panel global. |

**Importante:** los módulos del panel global que todavía usan estado de interfaz no se consideran operaciones administrativas reales. El endpoint global de lectura sí está protegido con comprobación de UID en PostgreSQL; no depende de selecciones de rol o parámetros enviados por el cliente.

## Crear cuatro identidades de manera segura

En el proyecto Supabase **`wrfwhftzaflwhkvkzrjm`**, entrar a **Authentication → Users → Add user**. Crear una cuenta individual, con email confirmado y contraseña diferente para cada perfil:

- Superadmin: `barberos.qa.superadmin@example.com`
- Barbería (dueño): `barberos.qa.dueno@example.com`
- Barbero independiente: `barberos.qa.independiente@example.com`
- Cliente: `barberos.qa.cliente@example.com`

Estos correos son **nombres propuestos, no usuarios existentes**. La opción `example.com` sirve únicamente para pruebas con correo confirmado manualmente por el administrador; no recibe mensajes reales. Usar únicamente contraseñas seguras propias y **no compartirlas por chat ni almacenarlas en GitHub**.

Cuando estén creados los cuatro usuarios, asignar autorizaciones con los UID reales:

1. Superadmin: insertar su UID en `public.platform_admins` desde el administrador autorizado, nunca desde el navegador o una ruta de registro pública.
2. Dueño: crear tenant real de prueba con membresía `owner` (por la API autenticada o flujo de alta).
3. Independiente: crear su tenant con membresía `owner`, definir `business_kind='independent'` mediante administración autorizada y vincular el registro de `barbers.user_id`.
4. Cliente: **no insertar ninguna membresía empresarial**.

Luego validar en `http://localhost:3000/login`, y probar permisos cruzados: usuarios no superadmin reciben HTTP 403 en `/api/v1/platform/tenants`; dueño/independiente solo pueden operar con sus propios tenant IDs; cliente solo accede a funciones públicas y datos propios.

## Seguridad

- Nunca agregar estas contraseñas a `src/`, `landing/`, `.env.local` del navegador, commits o logs.
- El rol superadmin nunca proviene de `user_metadata` editable por el usuario.
- El selector visual de roles ficticios y los reinicios de datos falsos fueron retirados del modo conectado.
- `Wompi` continúa desactivado y reservado solo a suscripciones SaaS de BarberOS en una fase posterior.

## Nota del entorno local comprobado

En la última revisión, el puerto `localhost:3000` estaba ocupado por **MIVRA OS**, ajeno a BarberOS. No se detuvo ni modificó esa aplicación. El login de BarberOS sí fue probado con Chromium en `http://127.0.0.1:3199/login` y cargó correctamente, sin menú de cuentas demo y limpiando `barberos_state_v2` antiguo. Para reservar el puerto 3000 a BarberOS deberá liberarlo previamente el operador, sin interferir con MIVRA OS.

La API real estaba `ready`, la integración autenticada probó que el dueño no obtiene permisos de superadmin y el asesor de seguridad de Supabase informó 0 alertas. La creación de identidades QA sigue pendiente del alta autorizada en Supabase Authentication.
