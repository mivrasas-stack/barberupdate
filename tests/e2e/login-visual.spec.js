import { test, expect } from '@playwright/test';

test('Login coincide con el diseño dividido Barber Paradise en escritorio', async ({page}) => {
  await page.setViewportSize({width:1903,height:944});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/login');
  const login=page.getByTestId('barber-paradise-login');
  await expect(login).toBeVisible();
  await expect(page.getByRole('heading',{name:/bienvenido\s+de vuelta/i})).toBeVisible();
  await expect(page.getByRole('button',{name:/iniciar sesión/i})).toBeVisible();
  await expect(page.getByLabel('Correo electrónico')).toBeVisible();
  await expect(page.getByLabel('Contraseña')).toBeVisible();
  const hero=login.locator('section').first();
  const photo=hero.locator('img');
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
  await page.screenshot({path:'test-results/barber-paradise-login-desktop.png',fullPage:true});
});

test('Login móvil conserva fotografía y formulario sin cortes horizontales', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/login');
  await expect(page.getByTestId('barber-paradise-login')).toBeVisible();
  await expect(page.getByRole('button',{name:/iniciar sesión/i})).toBeVisible();
  const photo=page.locator('img[src="/images/barber-paradise-atmosphere.webp"]');
  await expect(photo).toBeVisible();
  expect(await photo.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  const horizontalOverflow=await page.evaluate(()=>
    document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
  expect(horizontalOverflow).toBe(false);
  await page.screenshot({path:'test-results/barber-paradise-login-mobile.png',fullPage:true});
});
