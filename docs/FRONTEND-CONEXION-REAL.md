# BarberOS — integración real del frontend original, SIN REDISEÑARLO

**Alcance:** conservar exactamente la estructura de componentes y las clases CSS existentes.
Se modificaron funciones de autenticación, obtención de datos y eventos de la
interfaz, no el diseño de las páginas. No se han sustituido las vistas originales
por plantillas ni pantallas genéricas.

## Qué está conectado

- Desarrollo local: Vite en http://127.0.0.1:3199, proxy same-origin a la API de
  BarberOS en http://127.0.0.1:8188/api/v1.
- Inicio de sesión del formulario existente: Supabase Auth real por correo y
  contraseña, refresh de la sesión y validación en la API con Bearer JWT.
- Roles: se derivan de membresías reales. Las tarjetas de acceso inmediato y el
  cambio libre de perfil se bloquean al usar la API, porque no proporcionan
  autorización real. **El diseño visual de esas tarjetas no se cambió.**
- Alta de barbería nueva: una vez autenticado como usuario sin empresa, selecciona
  Propietario y el sistema pregunta el nombre, creando la empresa por API.
- Lecturas de empresa: empresas autorizadas, barberos, servicios, productos,
  citas, transacciones, cierres de caja, órdenes y planes disponibles.
- Portal cliente: consulta pública de empresas, servicios, barberos y productos.
- Servicios: creación y edición real (incluida migración SQL de permisos mínima
  para el rol restringido de PostgreSQL).
- Boutique: creación con nombre, SKU, categoría, descripción, imagen, costo,
  precio, stock, stock mínimo y visibilidad; ajuste de inventario y ocultar/mostrar
  productos en el catálogo público. Migración de catálogo aplicada.
- Agenda de barbería: nueva reserva, avance de estados y cancelación por API
  con validación de horarios y sin saltarse permisos.
- Reservas y pedidos de clientes: creación real, con Idempotency-Key y
  disponibilidad verificada por PostgreSQL.
- Caja: registro de gastos y cierre diario en PostgreSQL (no simulación).
- Notificaciones: sincronización REST con cursor después de autenticarse,
  cada 30 segundos y al recuperar la conexión. El WebSocket sigue siendo
  opcional por intermitencia del proveedor; el backend conserva la recuperación.

## Cómo abrir la INTERFAZ ORIGINAL en modo real

1. Mantener activos Docker y la API de BarberOS desde la raíz:

   ```powershell
   Set-Location 'C:\MIVRA PROYECTS\UPDATEBARBER'
   docker compose --env-file backend/.env -f infra/compose.yaml up -d --build
   ```

2. El archivo privado **`.env.local`** ya está configurado en la laptop
   autorizada y excluido de Git; contiene SOLO el URL y la clave pública de
   Supabase (más VITE_BACKEND_MODE=live y VITE_API_BASE_URL=/api/v1).
   Nunca colocar SUPABASE_SERVICE_ROLE_KEY ni credenciales PostgreSQL
   en el frontend, archivos VITE_* o navegadores.

3. **Es necesario contar con un usuario REAL de Supabase Auth**. Actualmente
   las pruebas E2E borran sus usuarios al finalizar, de modo que no existe
   un usuario de demostración permanente creado automáticamente.
   Crear una cuenta en el panel privado de Supabase del proyecto BarberOS:
   Authentication -> Users -> Add user (email y contraseña). No enviar la
   contraseña por ChatGPT ni guardarla en el repositorio.

4. Ejecutar desde la raíz:

   ```powershell
   npm run dev
   ```

   Abrir http://127.0.0.1:3199. Si Vite ya estaba abierto, reiniciarlo para
   que vuelva a leer `.env.local`.
   Ingresar el correo y contraseña en **el formulario visual que ya existía**.
   Seleccionar Propietario para crear la primera barbería, si no existe.

5. Comprobar http://127.0.0.1:8188/api/v1/health/ready.

6. Para clonar a otra laptop, configurar un nuevo `.env.local` con los
   valores **públicos** del mismo proyecto Supabase y no copiar secretos.

## Pruebas ejecutadas

- `npm run lint`: TypeScript aprobado.
- `npm run build`: aprobado, conservando el archivo CSS de salida de la
  versión visual anterior; no se editaron clases `className` ni archivos CSS.
- Proxy Vite local: HTML 200, readiness 200, planes 200, directorio 200;
  ruta privada /me sin JWT -> 401 (bloqueo esperado).
- E2E real con Auth, barberías aisladas, edición de servicios, boutique y
  visibilidad pública de productos, reservas, stock, pagos/devoluciones,
  reportes y Storage: aprobado, fixtures eliminados.
- `npm test` backend: 22 tests aprobados, 0 fallidos (4 E2E opt-in
  omitidos en el modo local).

## Limitaciones importantes de la integración actual

La integración es **real pero todavía NO abarca el 100% de los módulos visuales**.
En particular, el superadministrador global del diseño original, los
portafolios de fotos basados en URL, funciones de walk-in, algunos controles
de barberos y elementos demo de fidelización o contenido comercial requieren
completar sus endpoints/acciones. No se concede acceso de superadmin por
seleccionar esa tarjeta. No presentar esos módulos como persistidos si todavía
usan funciones del almacén de demostración.

El front original mantiene imágenes/espacios para fotos; las nuevas empresas
pueden aparecer sin imagen propia hasta que se configure Storage.

**Wompi queda desactivado:** exclusivamente reservado a la futura landing
page para comercializar suscripciones BarberOS, nunca para cobrar productos o
citas de barberías.

**Producción:** no existe aún dominio, hosting 24/7, alertas externas ni
restauración integral Auth/Storage. Este documento certifica la conexión
técnica local probada, no la disponibilidad pública al 100%.


## Verificacion final Playwright

Playwright Chromium: 7/7 pruebas aprobadas. Recorridos de propietario (12 vistas), cliente (8 vistas), creacion de servicio, inventario, reserva, pedido y rechazo de accesos sin rol valido. El puerto de presentacion es 3199; el 3000 es MIVRA OS y no se modifica. La suite se puede ejecutar con npm run test:e2e; solo usa cuentas y empresa temporales y las elimina. Ver docs/REPORTE-VALIDACION-PLAYWRIGHT.md. Para ingresar de verdad hay que dar de alta un usuario permanente en Supabase Auth BarberOS.
