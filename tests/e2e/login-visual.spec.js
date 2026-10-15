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
