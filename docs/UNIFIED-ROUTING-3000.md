# Barber Paradise + BarberOS: rutas unificadas en localhost:3000

## Rama de trabajo independiente

`feature/landing-login-unified-3000`. No se ha fusionado a `main`, y se conservan los cambios anteriores no relacionados de `package.json` y `.aistudio/`.

## Direcciones de la integración

| Ruta | Comportamiento |
| --- | --- |
| http://localhost:3000/ | Landing page Barber Paradise |
| http://localhost:3000/login | Login real BarberOS, Supabase Auth |
| http://localhost:3000/directorio | Directorio de barberías |
| http://localhost:3000/profesionales | Beneficios, módulos y planes |
| http://localhost:3000/register | Formulario público de presentación |
| http://localhost:3000/register/professional | Registro visual en tres pasos |
| http://localhost:3000/login#/barberia/... | Rutas internas BarberOS tras autenticarse |
| http://localhost:3000/#/login | Enlace anterior al login, conservado |
| http://localhost:3000/#/clientes/inicio | Hash antiguo: abre el sistema y exige autenticación |

La landing y el SPA comparten origen, pero no comparten estilos: `src/main.tsx` importa dinámicamente `landing/app.js` en rutas públicas y `src/react-entry.tsx` (React/Tailwind) para el sistema autenticado. Navegar recarga únicamente la aplicación pertinente.

## Login y fotografía

La **única modificación de diseño del login** está en su panel izquierdo: la imagen original de `http://localhost:9002/login` (archivo `public/images/barber-paradise-atmosphere.webp`) sustituyó el recorte anterior; el título y subtítulo se superponen como en la referencia, sin texto horneado dentro de la fotografía. El formulario, sus llamadas a Supabase y el resto de las pantallas del sistema se mantienen. No se muestra el recuadro de cuentas de desarrollo.

Las fotografías existentes de la landing se sirven también bajo `public/assets/` para que las rutas públicas funcionen por el mismo servidor Vite. `9002` (Next.js fuente) y `9102` (landing standalone previa) no fueron modificados ni detenidos.

## Ejecutar

Desde la raíz en la laptop autorizada:

```powershell
Set-Location 'C:\MIVRA PROYECTS\UPDATEBARBER'
npm run dev
```

Abrir `http://localhost:3000`. Si el servidor Vite de BarberOS ya está activo, no abras otro proceso en el mismo puerto.

Para ingresar necesitas una cuenta **real** de Supabase Auth y que la API BarberOS esté lista en `http://localhost:3000/api/v1/health/ready` (dev proxy a `127.0.0.1:8188`). La API normalmente requiere Docker Desktop y `infra/compose.yaml`; no deben usarse accesos demo para simular permisos.

## Pruebas

- `node node_modules/@playwright/test/cli.js test --config playwright.unified.config.ts`: 5/5 pruebas de navegador: portada, menú, navegación Directorio/Profesionales, plan, registro visual, login y fotografía, móvil y enlaces hash anteriores.
- `npm run lint` y `npm run build`: aprobados después de la integración.
- `npm run test:e2e`: suite previa de navegación, Supabase Auth y persistencia con fixtures temporales, requiere API/DB activas. La suite fue adaptada para ingresar por `/login` y ejecutarse en `localhost:3000`.

No se ha conectado Wompi: queda exclusivamente reservado para futuras suscripciones y licencias del SaaS BarberOS **desde la landing**, y nunca para cobros de citas, barberías o pedidos. El formulario comercial de la landing sigue siendo visual; no simula cargos reales.

Para el despliegue público habrá que configurar dominio/TLS y validar el alta comercial real. Esta integración sirve a la presentación local y no es una certificación de toda la infraestructura pública.

## Validación final

- API de BarberOS recuperada y validada: GET http://localhost:3000/api/v1/health/ready devolvió HTTP 200 con status `ready`.
- Playwright de rutas unificadas: **5 de 5 aprobadas**.
- Playwright funcional y visual con Supabase Auth / API / PostgreSQL reales: **9 de 9 aprobadas** (`npm run test:e2e`).
- Compilaciones root y landing standalone: aprobadas; CSS cargado por ruta.
