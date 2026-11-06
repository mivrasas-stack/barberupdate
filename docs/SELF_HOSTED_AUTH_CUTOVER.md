# BarberNow — salida segura del proveedor heredado de autenticación

## Estado real al crear este documento
- El PostgreSQL dedicado en VPS es `barbernow-db-postgres`, servidor PostgreSQL 17.11 en red privada; **no** es el PostgreSQL interno de Dokploy.
- La copia de trabajo `barbernow_stage` contiene las 36 tablas públicas restauradas. **No** es la base conectada a producción.
- Las tablas originales incluyen clientes, reservas, QR, caja, WhatsApp, afiliaciones y negocio. La fuente ha recibido escrituras tras la copia: realizar un snapshot final.
- Se resguardaron metadatos de 34 cuentas y sus hashes bcrypt $2a$ en el VPS. Esos archivos están fuera de Git, con acceso restringido. No transferirlos mediante el chat.
- El nuevo servicio de autenticación, sus tablas y rutas están en una rama **experimental**, desactivada en producción. Su prueba con cuentas reales y la configuración de SMTP aún están pendientes.
- No publicar/mergear la rama experimental sin las pruebas de integración y el checklist siguientes.

## WhatsApp OTP sin SMTP
- Plantilla `barbernow_codigo_acceso` de categoría `AUTHENTICATION`, idioma `es`, **APPROVED** por Meta.
- Códigos de 8 dígitos, 5 minutos de vencimiento, un solo uso, hash HMAC-SHA256, límites de Redis.
- Configurar `AUTH_OTP_SECRET` con al menos 32 bytes criptográficamente aleatorios codificados en base64, SOLO en el servidor.
- Todos los envíos se realizarán desde la única cuenta Meta Cloud API de BarberNow. No hay configuración por barbería ni SMTP.
- Los usuarios existentes deben verificar su número por WhatsApp desde una sesión iniciada; las cuentas sin teléfono verificado NO pueden recuperar por WhatsApp hasta verificarlo.
- Los flujos de invitaciones de personal y propietarios aún requieren pruebas y adaptación; NO habilitar el corte final sin resolverlos.
- Los códigos enviados por Meta deben entregarse realmente; aprobación de plantilla o respuesta HTTP 200 NO garantizan entrega.

## Validaciones antes de cambiar de base
1. Importar las 34 identidades con los mismos UUID, bcrypt, metadatos y confirmación de correo en `auth.users` local. No crear usuarios duplicados ni contraseñas predeterminadas.
2. Comprobar un login real del propietario con su contraseña existente en un entorno de pruebas aislado; probar cliente, barbero y administrador.
3. Probar registro/confirmación por WhatsApp, recuperación con celular previamente verificado, cambio de contraseña, rotación de refresh, revocación y expiración.
4. Migrar las imágenes/avatares y referencias a almacenamiento propio. Reemplazar todas las operaciones `storage`.
5. Adaptar el registro de dueños personalizado que existe solo en el árbol de código de producción local; proteger sus pruebas.
6. Verificar que las 36 tablas, funciones, triggers, enlaces QR, permisos, saldo y eventos WhatsApp coincidan entre origen y destino. Inspeccionar integridad de claves foráneas.
7. Configurar copias programadas de PostgreSQL y de los medios, con restauración comprobada.
8. Bloquear temporalmente nuevas escrituras en la fuente, volver a tomar respaldo y sincronizar todos los cambios pendientes.
9. Cambiar las API y el trabajador juntos a la base local, cambiar frontend a autenticación propia, eliminar claves anteriores y ejecutar smoke tests.
10. Mantener copia y plan de vuelta atrás; **no** eliminar el origen hasta completar verificación y respaldos.

## Atención
- Las contraseñas importadas deben conservarse como hashes. Jamás pedir contraseñas por chat ni crear claves temporales compartidas.
- Los IDs de usuario deben mantenerse iguales para las afiliaciones por QR y las citas existentes.
- No usar la base de datos `dokploy` para alojar datos de BarberNow.
- No se requiere SMTP. La activación y recuperación dependen de Meta WhatsApp y de un número que el usuario controle; mantener procedimiento manual seguro para usuarios sin teléfono verificado.
- El cambio de `DATABASE_URL` por sí solo rompe login, administración de usuarios y medios. Nunca hacerlo antes de los pasos anteriores.

[executed on device: vmi3669516 (22a9c8cd-8866-4186-9071-dab9301dff16)]