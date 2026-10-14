# BarberOS — vinculación real por QR (14 de octubre de 2026)

## Qué se implementó

- **QR escaneable y estable por empresa**: PostgreSQL crea un `link_code` aleatorio, único y persistente por tenant (barbería o estudio independiente). Solo el propietario o gerente obtiene su código mediante `GET /api/v1/tenants/:tenantId/link-code`.
- **Enlace de entrada**: `/vincular/<link_code>` lleva a una pantalla pública con el nombre real del negocio. `GET /api/v1/public/links/:code` consulta exclusivamente negocios activos; no entrega datos empresariales privados.
- **Alta del cliente**: formulario con nombre completo, teléfono, correo, contraseña y aceptación de la vinculación. Supabase Auth autentica al usuario; si exige verificar email, el formulario lo indica. Una cuenta existente puede iniciar sesión ahí mismo.
- **Vinculación persistente**: `POST /api/v1/me/links` exige un JWT auténtico y un código válido; inserta el perfil del cliente y su asociación en una sola transacción. No otorga membresía de staff ni poderes administrativos. El perfil profesional independiente debe existir y estar activo.
- **Múltiples asociaciones**: `GET /api/v1/me/links` devuelve solo los negocios del cliente autenticado. Un segundo escaneo no duplica la asociación gracias a la clave primaria `(user_id,tenant_id)`.
- **Pantallas conservadas**: la vista del dueño muestra el QR real, enlace, copiar e imprimir. El portal de clientes cuenta con lector de cámara real (ZXing), opción manual, asociados en inicio y en pantalla de escaneo. La reserva muestra primero los negocios asociados y permite elegir profesionales independientes.
- **No hay códigos demo** ni simulación de lectura de cámara en la pantalla de vinculación real.

## Rutas y seguridad

`GET /api/v1/public/links/:code` — consulta pública limitada por Redis.
`GET /api/v1/tenants/:tenantId/link-code` — propietario/gerente autenticado del tenant.
`GET /api/v1/me/links` — solamente asociaciones del usuario autenticado.
`POST /api/v1/me/links` — JWT, perfil completo, código de empresa activa, cliente no perteneciente a staff/superadmin.

Migración: `supabase/migrations/20261014000200_qr_client_affiliations.sql` aplicada al proyecto autorizado `wrfwhftzaflwhkvkzrjm`. Se agregaron `tenants.link_code`, `customer_profiles` y `customer_links`, con RLS habilitado.

## Pruebas verificadas

- `RUN_LIVE_QR_INTEGRATION=1 node --env-file=.env --env-file=.env.admin.local --test test/qr-links.test.js`: **1/1 aprobada** con dos empresas, cliente real temporal y limpieza final. Validó unicidad, consulta pública, registro, persistencia, repetición idempotente, aislamiento entre empresas, rechazo de dueños y de clientes sin JWT.
- Playwright `tests/e2e/connection.spec.js` bajo `playwright.qr.config.ts`: generó un QR PNG y lo **decodificó** para comprobar su URL; abrió el registro de vinculación en Chromium con cuenta de cliente temporal; comprobó el negocio en el inicio y en el formulario de reservas.
- `npm run lint`, `npm run build`, comprobación de sintaxis de API y readiness: aprobados.

## Uso en dispositivos móviles

`localhost` / `127.0.0.1` únicamente funcionan desde el **mismo equipo**. Para que un cliente escanee el QR impreso desde su propio teléfono debe usarse un **dominio público con HTTPS válido** y hacer que el dueño lo genere desde esa URL. El lector de cámara también requiere un contexto seguro HTTPS (o localhost), y permiso explícito de cámara.

La nueva vinculación no crea ni comprueba pagos. **Wompi permanece apagado** y reservado exclusivamente para venta futura de suscripciones SaaS de BarberOS desde la landing.

## Limitaciones transparentes

No se ha validado físicamente una cámara de un teléfono real; se comprobaron el decodificador QR, la URL y el flujo integral en un navegador Chromium automatizado. Las secciones de fidelidad y otros módulos comerciales conservan sus propias limitaciones anteriores, independientes de la vinculación QR.
