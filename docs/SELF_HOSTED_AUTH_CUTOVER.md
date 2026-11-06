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


## Progreso adicional del 5 de noviembre de 2026
- La plantilla de autenticación `barbernow_codigo_acceso` está aprobada en Meta. **No se ha confirmado la entrega real de un OTP**, por tanto no se debe activar producción.
- Se copiaron y verificaron **9 imágenes** desde el origen al volumen privado `barbernow_media_data` en el VPS. El inventario y SHA-256 están en `/opt/barbernow/migration-backups/source-20261105/media-migration-manifest.json`.
- Las referencias de imágenes en la base aislada `barbernow_stage` apuntan al servidor local. La base pública sigue intacta.
- Se incluyeron el registro de propietarios, el ingreso por QR, la invitación administrativa y la subida/lectura de fotos sin servidor SMTP.
- Las cuentas originales NO están activas en el PostgreSQL propio: la copia `barbernow_stage` aún no tiene los 34 hashes de contraseña importados. El archivo de exportación privada permanece en el VPS, fuera de Git.
- La prueba del contenedor API aislado no se pudo completar por una configuración de clave de firma inválida. No se conectó a la web pública.
- El corte final sigue BLOQUEADO hasta validar credenciales migradas, seguridad real por roles, WhatsApp OTP entregado, sincronización de citas y copia de recuperación.

## Permisos del almacenamiento local
- El proceso Node se ejecuta con UID 1000; el volumen de medios compartido debe permitir lectura/escritura a ese UID.
- Los dos contenedores API deben montar el mismo volumen `barbernow_media_data` en `/var/lib/barbernow/media`.
- Resguardar ese volumen periódicamente junto con el PostgreSQL; probar al menos una restauración.
- No exponer el PostgreSQL ni el volumen de archivos al público; solo la API entrega los archivos verificados.


## Cierre de preproducción: 6 de noviembre de 2026
- PostgreSQL 17 del VPS en `barbernow-db-postgres`, base candidata `barbernow_candidate` con **37 usuarios reales y sus 37 hashes bcrypt**, además de un registro de referencia heredada (sin correo, sin contraseña y bloqueado) asociado a la barbería histórica `admin`.
- Snapshot comercial actualizado y restaurado: **6 negocios, 18 perfiles de clientes, 18 vinculaciones por QR, 35 citas y 16 mensajes de WhatsApp**. No reemplazar estos datos sin un snapshot nuevo durante el corte.
- **11 archivos de imagen diferentes** presentes en el volumen `barbernow_media_data`; se copiaron también los avatares desde los metadatos de autenticación. La base candidata ya no contiene referencias de foto a `supabase.co` en perfiles, barberías o portafolios.
- API local aislada, PostgreSQL y Redis de pruebas en red interna Docker; **HTTP 200** en readiness. No se configuró ningún servicio Supabase en las variables del contenedor candidato.
- Prueba HTTP real de autenticación con usuario ficticio y contraseña bcrypt: login, token de acceso, rotación, revocación y logout aprobados. Prueba de media: upload firmado, lectura, integridad binaria y rechazo de firma falsa.
- Pruebas automáticas: backend 107 aprobadas, 0 fallidas, 5 omitidas; seis pruebas de registro de propietario aprobadas. TypeScript y compilación Vite correctos. GitHub Actions debe terminar de validar el PR #37.
- **PENDIENTE DE VERIFICACIÓN REAL:** envío y entrega del código OTP al WhatsApp del propietario, con consentimiento. La plantilla `barbernow_codigo_acceso` está aprobada por Meta, pero su diagnóstico de salud sigue en `LIMITED` por código 141010 de verificación empresarial. No confundir aprobación de plantilla con entrega de mensaje.
- **NO REALIZAR CORTE AUTOMÁTICO**: el servidor de origen sigue recibiendo cuentas, citas y mensajes. Para cortar se debe detener temporalmente la escritura, tomar un snapshot final coherente, reexportar hashes y datos de los usuarios creados después de este documento, restaurar/verificar, desplegar de forma coordinada API/worker/web y realizar pruebas de login por rol, cita y caja. Tener scripts de reversión y respaldos probados.
- El PostgreSQL interno de Dokploy no debe alterarse: se usa el contenedor propio `barbernow-db-postgres`.