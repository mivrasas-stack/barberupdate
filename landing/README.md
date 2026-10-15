# BarberNow — réplica independiente de la landing

**Código:** `C:\MIVRA PROYECTS\UPDATEBARBER\landing`
**Referencia visual original:** http://127.0.0.1:9002
**Réplica independiente:** http://127.0.0.1:9102

Esta carpeta contiene exclusivamente una landing autónoma de BarberNow:
`index.html`, `app.js`, `styles.css`, fotografías copiadas de la web
original a `public/assets/` y un test de navegador con Playwright.

## Qué se ha reproducido

- Portada fotográfica, tipografía Outfit, menú responsive, paleta negro/dorado,
  botones, manifiesto, estadísticas, fotografía secundaria, CTA y footer.
- `/directorio`: estado vacío de barberías verificadas. No se inventan negocios.
- `/profesionales`: cabecera, seis beneficios, tres pasos de afiliación,
  tres planes y CTA final. Precios/textos visuales tomados de la referencia.
- `/register/professional`: pasos de presentación y selección de plan.
- `/register` y `/login`: enlaces hacia el sistema real, sin capturar ni
  almacenar contraseñas dentro de la landing.
- Menú móvil, navegación, anclas y cambio de tema.

El sitio fuente del puerto 9002 y el frontend operativo de BarberNow del
puerto 3199 NO fueron reemplazados; siguen siendo aplicaciones separadas.
No se tocaron el backend, la base de datos ni otros servicios de Docker.

## Iniciar la réplica

En PowerShell:

```powershell
Set-Location 'C:\MIVRA PROYECTS\UPDATEBARBER\landing'
npm run dev
```

Abrir http://127.0.0.1:9102.

Se utiliza Vite del repositorio BarberNow (instalación previa de dependencias
en la raíz requerida), evitando duplicar dependencias y alterar el frontend.

## Generar una versión estática de entrega

```powershell
Set-Location 'C:\MIVRA PROYECTS\UPDATEBARBER\landing'
npm run build
```

El resultado queda en `landing/dist/`, incluidas las fotografías locales.
Se puede alojar en un servidor estático con redirección SPA a `index.html`
para las rutas `/directorio`, `/profesionales` y de registro.

## Pruebas Playwright

```powershell
Set-Location 'C:\MIVRA PROYECTS\UPDATEBARBER'
node landing/test-landing.cjs
```

Última ejecución: 10 combinaciones de ruta/dispositivo aprobadas,
cero errores JavaScript, imágenes cargadas, cero desbordamientos horizontales,
y navegación comprobada a Directorio, Profesionales y el formulario de tres pasos.
Vista de escritorio 1440×900 y móvil 390×844. La altura visual final respecto
al original fue cercana: portada escritorio 3513 vs 3491 px; portada móvil
4257 vs 4214 px; página Profesionales móvil 7623 vs 7583 px.

## Importante: registro, pagos y certificación

Los planes y promesas comerciales reproducen lo que muestra el sitio original,
pero **la contratación/activación comercial real todavía no se ha integrado**.
El formulario de tres pasos no envía datos personales a un backend ni factura.
El botón de acceso termina en el login existente de BarberNow en
http://localhost:3000/login. Antes de publicar en Internet debe sustituirse
esa URL local por el dominio definitivo.

Wompi sigue **desactivado**, reservado EXCLUSIVAMENTE para cobrar
suscripciones/licencias del SaaS BarberNow mediante esta landing futura.
No debe emplearse para cobrar productos, citas o servicios de barberías.

No se afirma identidad píxel por píxel: son una réplica de componentes, textos,
fotografías, dimensiones y navegación observada de la web local; los recorridos
de alta y contratación completos necesitarán configuración del negocio
y un despliegue público cuando lo apruebe su propietario.

## Integración principal en puerto 3000

Desde la raíz de UPDATEBARBER, `npm run dev` publica la landing en http://localhost:3000 y el login real en http://localhost:3000/login. Las rutas de Directorio, Profesionales y registro comparten el mismo origen sin alterar las vistas internas. Ver docs/UNIFIED-ROUTING-3000.md. La instancia standalone en 9102 sigue siendo opcional.
