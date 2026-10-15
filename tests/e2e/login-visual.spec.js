import { test, expect } from '@playwright/test';

test('Login coincide con el diseño dividido BarberNow en escritorio', async ({page}) => {
  await page.setViewportSize({width:1903,height:944});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/login');
  const login=page.getByTestId('barbernow-login');
  await expect(login).toBeVisible();
  await expect(page.getByRole('heading',{name:/bienvenido\s+de vuelta/i})).toBeVisible();
  await expect(page.getByRole('button',{name:/iniciar sesión/i})).toBeVisible();
  await expect(page.getByLabel('Correo electrónico')).toBeVisible();
  await expect(page.getByLabel('Contraseña')).toBeVisible();
  const hero=login.locator('section').first();
  const photo=hero.locator('img').first();
  const brand=hero.locator('img[src="/branding/barbernow-logo.png"]');
  await expect(brand).toBeVisible();
  expect(await brand.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  await expect(photo).toBeVisible();
  expect(await photo.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  const left=await hero.boundingBox();
  const card=await login.locator('section').nth(1).locator(':scope > div').boundingBox();
  expect(left.width).toBeGreaterThan(940);
  expect(left.width).toBeLessThan(965);
  expect(card.width).toBeGreaterThan(430);
  expect(card.width).toBeLessThan(460);
  expect(Math.abs(card.y-39)).toBeLessThan(5);
  await expect(page.getByText('Cuentas de Desarrollo')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Owner',exact:true})).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.screenshot({path:'test-results/barbernow-login-desktop.png',fullPage:true});
});

test('Login móvil conserva fotografía y formulario sin cortes horizontales', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/login');
  await expect(page.getByTestId('barbernow-login')).toBeVisible();
  await expect(page.getByRole('button',{name:/iniciar sesión/i})).toBeVisible();
  const photo=page.locator('img[src="/images/barber-paradise-atmosphere.webp"]');
  const brand=page.locator('img[src="/branding/barbernow-logo.png"]');
  await expect(brand).toBeVisible();
  await expect(photo).toBeVisible();
  expect(await photo.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  const horizontalOverflow=await page.evaluate(()=>
    document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
  expect(horizontalOverflow).toBe(false);
  await page.screenshot({path:'test-results/barbernow-login-mobile.png',fullPage:true});
});


test('Landing BarberNow revela portada y secciones durante el scroll', async ({page}) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const hero = page.locator('.hero h1');
  await expect(page.locator('html')).toHaveClass(/bn-motion/);
  await expect(hero).toHaveClass(/bn-reveal/);
  await expect(hero).toHaveClass(/bn-visible/, {timeout:5000});
  const about = page.locator('.about h2');
  await about.scrollIntoViewIfNeeded();
  await expect(about).toHaveClass(/bn-visible/, {timeout:5000});
  const cta = page.locator('.cta h2');
  await cta.scrollIntoViewIfNeeded();
  await expect(cta).toHaveClass(/bn-visible/, {timeout:5000});
  const logo = page.locator('.nav .brand-logo');
  await expect(logo).toHaveAttribute('src','/branding/barbernow-logo.png');
  expect(await logo.evaluate(img => {
    const styles = getComputedStyle(img);
    return styles.backgroundColor === 'rgba(0, 0, 0, 0)' &&
      styles.borderTopWidth === '0px' && styles.borderRadius === '0px';
  })).toBe(true);
  expect(errors).toEqual([]);
});

test('Landing respeta la preferencia de movimiento reducido', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveClass(/bn-motion/);
  await expect(page.locator('.hero h1')).toBeVisible();
  await expect(page.locator('.about h2')).not.toHaveClass(/bn-reveal/);
});


test('Cabecera BarberNow conserva el logo, no muestra rutas de cliente y enseña fecha y hora de Colombia', async ({page}) => {
  // 05:41 UTC corresponde a las 00:41 en Colombia.
  await page.clock.install({time:new Date('2026-10-15T05:41:00Z')});
  await page.setViewportSize({width:1708,height:900});
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill('camilo.torres@gmail.com');
  await page.getByRole('button',{name:/iniciar sesión/i}).click();
  const header=page.getByRole('banner');
  await expect(header).toBeVisible();
  const logo=header.locator('img[src="/branding/barbernow-logo.png"]');
  await expect(logo).toBeVisible();
  expect(await logo.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  await expect(header).not.toContainText('Portal Clientes / Inicio');
  await expect(header).not.toContainText('Portal Clientes');
  const clock=page.getByTestId('barbernow-header-clock');
  await expect(clock).toBeVisible();
  await expect(clock).toHaveAttribute('title',/Colombia.*Bogotá/);
  await expect(clock).toContainText(/15 oct/i);
  await expect(clock).toContainText(/12:41/);
  await page.clock.fastForward(61000);
  await expect(clock).toContainText(/12:42/);
  const account=header.getByRole('button',{name:/Camilo Andrés Torres/});
  await account.click();
  await expect(header.getByRole('button',{name:'Paleta de Colores'})).toBeVisible();
  await expect(header.getByRole('group',{name:'Seleccionar moneda'})).toBeVisible();
});

test('La cabecera móvil no modifica el logo ni pierde la fecha y hora', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill('camilo.torres@gmail.com');
  await page.getByRole('button',{name:/iniciar sesión/i}).click();
  const header=page.getByRole('banner');
  await expect(header.locator('img[src="/branding/barbernow-logo.png"]')).toBeVisible();
  await expect(page.getByTestId('barbernow-header-clock')).toBeVisible();
  await expect(page.getByTestId('barbernow-header-clock')).toContainText(/\d{1,2}:\d{2}/);
  await expect(page.getByTestId('barbernow-header-clock')).toContainText(/\d{1,2} [a-z]{3}/i);
  await expect(header).not.toContainText('Portal Clientes');
  const fits=await header.evaluate(node=>node.scrollWidth<=node.clientWidth+1);
  expect(fits).toBe(true);
});


test('Cliente edita datos de perfil sin preferencias de corte predefinidas',async({page})=>{
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill('camilo.torres@gmail.com');
  await page.getByRole('button',{name:/iniciar sesión/i}).click();
  await page.evaluate(()=>{location.hash='#/clientes/perfil';});
  await expect(page.getByRole('heading',{name:'Mi Perfil de Cliente'})).toBeVisible();
  await expect(page.getByLabel('Estilo habitual')).toHaveValue('');
  await expect(page.getByLabel('Preferencia de barba')).toHaveValue('');
  await expect(page.getByText('Degradado medio con navaja (Skin Fade)')).toHaveCount(0);
  await page.getByLabel('Nombre y apellidos').fill('Cliente Actualizado QA');
  await page.getByLabel('Estilo habitual').fill('Corte clásico');
  await page.getByRole('button',{name:'Guardar mi perfil'}).click();
  await expect(page.getByRole('banner')).toContainText('Cliente Actualizado QA');
});

test('Agendamiento recupera calendario de tres columnas sin profesionales independientes',async({page})=>{
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill('camilo.torres@gmail.com');
  await page.getByRole('button',{name:/iniciar sesión/i}).click();
  await page.evaluate(()=>{location.hash='#/clientes/citas/nueva';});
  await expect(page.getByText('Paso 1: Elige tu Barbería')).toBeVisible();
  await expect(page.getByText('Barberos Independientes')).toHaveCount(0);
  await page.getByRole('button',{name:/Continuar a Servicios/i}).click();
  await page.locator('button:has(h3)').first().click();
  await page.getByRole('button',{name:'Continuar',exact:true}).click();
  await page.locator('button:has(h3)').first().click();
  await page.getByRole('button',{name:'Elegir Horario'}).click();
  await expect(page.getByText('Paso 4: Fecha & Franja Horaria')).toBeVisible();
  await expect(page.getByRole('button',{name:'Mes siguiente'})).toBeVisible();
  await expect(page.getByLabel('Horarios disponibles por hora')).toBeVisible();
  await expect(page.getByText('Servicio seleccionado')).toBeVisible();
  await expect(page.getByText('Quién te atiende')).toBeVisible();
});


test('Agenda del dueño inicia el jueves actual y avanza automáticamente al viernes colombiano',async({page})=>{
  await page.clock.install({time:new Date('2026-10-16T04:59:30Z')}); // jueves 15, 23:59:30 Bogotá
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill('contacto@barberclub.co');
  await page.getByRole('button',{name:/iniciar sesión/i}).click();
  await page.evaluate(()=>{location.hash='#/barberia/shop-1/agenda';});
  await expect(page.getByRole('heading',{name:/Agenda Global/i})).toBeVisible();
  await expect(page.getByTestId('agenda-day-2026-10-15')).toBeVisible();
  await expect(page.getByTestId('agenda-day-2026-10-16')).toBeVisible();
  await page.clock.fastForward(90_000);
  await expect(page.getByTestId('agenda-day-2026-10-16')).toBeVisible();
  await expect(page.getByTestId('agenda-day-2026-10-15')).toHaveCount(0);
  await page.getByRole('button',{name:'Hoy',exact:true}).click();
  await expect(page.locator('input[type="date"]').first()).toHaveValue('2026-10-16');
});

test('Al seleccionar una cita se abre su ficha sin cambiar el estado y permite iniciar o registrar ausencia',async({page})=>{
  await page.clock.install({time:new Date('2026-10-15T15:00:00Z')});
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill('contacto@barberclub.co');
  await page.getByRole('button',{name:/iniciar sesión/i}).click();
  await page.evaluate(()=>{location.hash='#/barberia/shop-1/agenda';});
  await expect(page.getByRole('heading',{name:/Agenda Global/i})).toBeVisible();
  await page.locator('input[type="date"]').first().fill('2026-10-13');
  await page.getByRole('button',{name:'Lista',exact:true}).click();
  const row=page.getByRole('row').filter({hasText:'Mauricio Gómez'});
  await expect(row).toContainText('confirmed');
  await row.getByRole('button',{name:'Ver detalle'}).click();
  const modal=page.getByRole('dialog',{name:'Detalle de la cita'});
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('Mauricio Gómez');
  await expect(modal).toContainText('confirmed');
  await expect(modal.getByRole('button',{name:'Iniciar corte'})).toBeVisible();
  await expect(modal.getByRole('button',{name:'El cliente no asistió'})).toBeEnabled();
  await expect(row).toContainText('confirmed'); // Opening the details is read-only.
  await modal.getByRole('button',{name:'Cerrar detalle'}).click();
  await expect(modal).toHaveCount(0);
});


test('Barbero inicia, confirma un cobro y consulta su comprobante en pocos toques',async({page})=>{
 await page.clock.install({time:new Date('2026-10-13T20:40:00Z')});
 await page.goto('/login');
 await page.getByLabel('Correo electrónico').fill('santi@barberclub.co');
 await page.getByRole('button',{name:/iniciar sesión/i}).click();
 await page.evaluate(()=>{location.hash='#/barbero/shop-1/agenda';});
 await expect(page.getByRole('heading',{name:/Agenda Semanal de/i})).toBeVisible();
 await page.getByRole('button',{name:'Lista',exact:true}).click();
 const row=page.getByRole('row').filter({hasText:'Guillermo Ospina'});
 await expect(row).toContainText('waiting');
 await row.getByRole('button',{name:'Iniciar corte'}).click();
 await expect(row).toContainText('in_service');
 await row.getByRole('button',{name:'Cobrar y finalizar'}).click();
 const payment=page.getByRole('dialog',{name:'Cobrar y finalizar corte'});
 await expect(payment).toBeVisible();
 await expect(payment.getByText(/45.000/)).toBeVisible();
 await payment.getByRole('button',{name:'Efectivo'}).click();
 await payment.getByRole('button',{name:/Confirmar pago recibido y finalizar/}).click();
 const receipt=page.getByRole('dialog',{name:'Comprobante del corte'});
 await expect(receipt).toBeVisible();
 await expect(receipt).toContainText('Guillermo Ospina');
 await expect(receipt).toContainText('cash');
 await expect(receipt).toContainText('Movimiento contable');
 await receipt.getByRole('button',{name:'Listo'}).click();
 await expect(row).toContainText('completed');
 await row.getByRole('button',{name:'Comprobante'}).click();
 await expect(page.getByRole('dialog',{name:'Comprobante del corte'})).toBeVisible();
});

test('Barbero registra ausencia con motivo y conserva el historial de la cita',async({page})=>{
 await page.clock.install({time:new Date('2026-10-14T00:40:00Z')});
 await page.goto('/login');
 await page.getByLabel('Correo electrónico').fill('santi@barberclub.co');
 await page.getByRole('button',{name:/iniciar sesión/i}).click();
 await page.evaluate(()=>{location.hash='#/barbero/shop-1/agenda';});
 await expect(page.getByRole('heading',{name:/Agenda Semanal de/i})).toBeVisible();
 await page.getByRole('button',{name:'Lista',exact:true}).click();
 const row=page.getByRole('row').filter({hasText:'Esteban Cárdenas'});
 await expect(row).toContainText('pending');
 await row.getByRole('button',{name:'No llegó'}).click();
 const modal=page.getByRole('dialog',{name:'Cliente no llegó'});
 await expect(modal.getByLabel('Motivo')).toHaveValue('Cliente no asistió a la cita');
 await modal.getByRole('button',{name:'Confirmar ausencia'}).click();
 await expect(modal).toHaveCount(0);
 await expect(row).toContainText('no_show');
 await expect(row).toContainText('Cliente no asistió');
});


test('Agenda del dueño permite iniciar directo incluso citas antiguas pendientes; sin confirmar ni registrar llegada',async({page})=>{
 await page.clock.install({time:new Date('2026-10-15T15:00:00Z')});
 await page.goto('/login');
 await page.getByLabel('Correo electrónico').fill('contacto@barberclub.co');
 await page.getByRole('button',{name:/iniciar sesión/i}).click();
 await page.evaluate(()=>{location.hash='#/barberia/shop-1/agenda';});
 await expect(page.getByRole('heading',{name:/Agenda Global/i})).toBeVisible();
 await page.getByRole('button',{name:'Lista',exact:true}).click();
 const pending=page.getByRole('row').filter({hasText:'Esteban Cárdenas'});
 await expect(pending).toContainText('pending');
 await pending.getByRole('button',{name:'Ver detalle'}).click();
 const detail=page.getByRole('dialog',{name:'Detalle de la cita'});
 await expect(detail.getByRole('button',{name:'Iniciar corte'})).toBeVisible();
 await expect(detail.getByRole('button',{name:'Confirmar cita'})).toHaveCount(0);
 await expect(detail.getByRole('button',{name:'Registrar llegada del cliente'})).toHaveCount(0);
 await detail.getByRole('button',{name:'Iniciar corte'}).click();
 await expect(detail).toHaveCount(0);
 await expect(pending).toContainText('in_service');
});

test('BarberNow muestra confirmación de cancelación personalizada sin alertas localhost',async({page})=>{
 await page.clock.install({time:new Date('2026-10-15T15:00:00Z')});
 await page.goto('/login');
 await page.getByLabel('Correo electrónico').fill('contacto@barberclub.co');
 await page.getByRole('button',{name:/iniciar sesión/i}).click();
 await page.evaluate(()=>{location.hash='#/barberia/shop-1/agenda';});
 await expect(page.getByRole('heading',{name:/Agenda Global/i})).toBeVisible();
 await page.getByRole('button',{name:'Lista',exact:true}).click();
 const row=page.getByRole('row').filter({hasText:'Mauricio Gómez'});
 await row.getByRole('button',{name:'Ver detalle'}).click();
 const detail=page.getByRole('dialog',{name:'Detalle de la cita'});
 await detail.getByRole('button',{name:'Cancelar cita y liberar horario'}).click();
 await expect(detail).toHaveCount(0);
 const custom=page.getByRole('dialog',{name:'Cancelar cita'});
 await expect(custom).toBeVisible();
 await expect(custom.getByLabel('Motivo')).toHaveValue('Cancelada a solicitud del cliente');
 await custom.getByLabel('Motivo').selectOption('Otro motivo');
 await custom.getByLabel('Escribe el motivo').fill('Cliente informó que no podrá venir');
 await custom.getByRole('button',{name:'Confirmar cancelación'}).click();
 await expect(custom).toHaveCount(0);
 await expect(row).toContainText('cancelled');
 await row.getByRole('button',{name:'Ver detalle'}).click();
 await expect(page.getByRole('dialog',{name:'Detalle de la cita'})).toContainText('Cliente informó que no podrá venir');
});
