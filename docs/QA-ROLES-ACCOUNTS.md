# BarberOS — cuentas de prueba con permisos asignados

**Estado verificado: permisos asignados en el proyecto Supabase `wrfwhftzaflwhkvkzrjm`.** Las cuatro identidades existen, tienen el correo confirmado y son cuentas de prueba específicas. No se cambió la contraseña de ninguna.

| Perfil | Email confirmado | Autorización real |
|---|---|---|
| Superadmin | `barberos.qa.superadmin@example.com` | UID autorizado en `public.platform_admins`; acceso a `GET /api/v1/platform/tenants`. Sin membresías en empresas. |
| Dueño | `barberos.qa.dueno@example.com` | `owner` de **Barbería QA (Pruebas)**, slug `barberos-roleqa-dueno-20261014`, `business_kind='barbershop'`. |
| Independiente | `barberos.qa.independiente@example.com` | `owner` de **Estudio Independiente QA (Pruebas)**, slug `barberos-roleqa-independiente-20261014`, `business_kind='independent'`. Perfil profesional propio asociado a su UID. |
| Cliente | `barberos.qa.cliente@example.com` | Sin membresías ni privilegios globales; funciones públicas, reservas y pedidos propios. |

La asignación se realizó mediante una única transacción SQL con comprobación de cuatro UID distintos y correos confirmados. Se rechazaban asignaciones previas y slugs duplicados. La consulta posterior confirmó el resultado de las cuatro identidades.

## Límites de autorización

- Superadmin: directorio global de empresas; **no** dispone de acceso automático a los datos privados de cada empresa. Otras operaciones del panel global requieren backend adicional; no confundir pantallas de UI con permisos REST efectivamente implementados.
- Dueño: gestiona exclusivamente su barbería de pruebas mediante permisos `tenant_members.role='owner'`.
- Independiente: gestiona exclusivamente su workspace de tipo independiente; la UI reconoce `barber_independent` y utiliza su perfil profesional vinculado.
- Cliente: carece de membresías empresariales y no puede administrar ningún tenant.
- La autorización se basa en UID y membresías reales del servidor, nunca en seleccionar un rol en la interfaz.
- El login se corrigió para decidir si ofrece crear un negocio a partir del **rol resuelto por el servidor**, nunca de una pista de rol proporcionada por el formulario.

## Para ingresar

Utilizar las contraseñas que se establecieron al crear las cuatro cuentas. **No están ni deben estar en Git.** El login de BarberOS está en `http://127.0.0.1:3199/login` cuando Vite de BarberOS ocupa el puerto 3199. La ruta `http://localhost:3000/login` funciona solo cuando la instancia unificada de BarberOS dispone de ese puerto; en las revisiones recientes el 3000 pertenecía a otra aplicación (MIVRA OS) que no se modificó.

El proyecto backend debe estar activo (readiness comprobada en `http://127.0.0.1:8188/api/v1/health/ready`).

## Validación y pendientes

- Cuatro cuentas reales: existencia y email confirmado, **4/4**.
- Membresías de empresa, tipo de negocio, profesional vinculado y asignación global: comprobados directamente en PostgreSQL.
- Endpoint global sin JWT: HTTP 401.
- API readiness: `ready`. Frontend: typecheck y compilación aprobados.
- Las pruebas previas E2E del backend rechazaron permisos globales para dueños corrientes y accesos entre empresas.
- **No se han repetido logins reales con las contraseñas de estas cuatro cuentas**, que no se conocen ni se necesitan en la administración SQL. Probar las cuatro rutas y las operaciones desde el navegador con sus respectivos usuarios al recibir las contraseñas creadas por el operador.
- Supabase Security Advisor actualmente advierte: *Leaked Password Protection Disabled*; habilitar protección contra contraseñas filtradas en la configuración de Auth antes de producción.
- Wompi sigue diferido, reservado únicamente para suscripciones SaaS de BarberOS desde la futura landing y nunca para pagos de barberías.
