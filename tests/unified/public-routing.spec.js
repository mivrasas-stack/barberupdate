import {test,expect} from '@playwright/test';

test('Landing, Directorio y Profesionales navegan sin cambiar de host',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 const appOrigin=new URL(page.url()).origin;
 await expect(page).toHaveTitle('BarberParadise');
 await expect(page.getByRole('heading',{name:/NO HACEMOS CORTES/i})).toBeVisible();
 await expect(page.locator('.hero-bg')).toHaveCSS('background-image',/hero.webp/);
 await page.getByRole('link',{name:'PROFESIONALES'}).click();
 await expect(page).toHaveURL(new URL('/profesionales',appOrigin).href);
 await expect(page.getByRole('heading',{name:/TU TALENTO.*TU MARCA/i})).toBeVisible();
 await page.getByRole('link',{name:'BARBER PARADISE'}).first().click();
 await expect(page).toHaveURL(new URL('/',appOrigin).href);
 await page.getByRole('link',{name:'DIRECTORIO'}).click();
 await expect(page.getByRole('heading',{name:/BARBERÍAS.*VERIFICADAS/i})).toBeVisible();
 expect(errors).toEqual([]);
});
test('Reservar abre login real, muestra foto original y regresa a landing',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 const appOrigin=new URL(page.url()).origin;
 await page.locator('.hero-buttons a[href="/login"]').click();
 await expect(page).toHaveURL(new URL('/login',appOrigin).href);
 await expect(page.getByTestId('barber-paradise-login')).toBeVisible();
 await expect(page.getByRole('heading',{name:/BIENVENIDO.*DE VUELTA/i})).toBeVisible();
 await expect(page.getByLabel('Correo electrónico')).toBeVisible();
 await expect(page.getByLabel('Contraseña')).toBeVisible();
 await expect(page.getByRole('button',{name:/INICIAR SESIÓN/i})).toBeVisible();
 const img=page.locator('img[src="/images/barber-paradise-atmosphere.webp"]');
 await expect(img).toBeVisible();
 await expect.poll(()=>img.evaluate(x=>x.complete&&x.naturalWidth>0)).toBe(true);
 await expect(page.getByText('Cuentas de Desarrollo')).toHaveCount(0);
 await page.getByRole('link',{name:/VOLVER A LA PÁGINA WEB/i}).click();
 await expect(page).toHaveURL(new URL('/',appOrigin).href);
 expect(errors).toEqual([]);
});
test('Planes mantienen parámetros y registro visual de tres pasos',async({page})=>{
 await page.goto('/profesionales');
 await page.getByRole('link',{name:/COMENZAR 14 DÍAS GRATIS/i}).nth(1).click();
 await expect(page).toHaveURL(/\/register\/professional\?plan=SOLO_PRO/);
 await expect(page.getByText('Paso 1 de 3')).toBeVisible();
 await page.getByPlaceholder('Ej. Carlos Mendoza').fill('Cliente de prueba');
 await page.getByPlaceholder('carlos@ejemplo.com').fill('test@example.com');
 await page.getByPlaceholder('+57 300 123 4567').fill('3001234567');
 await page.getByPlaceholder('Mínimo 8 caracteres').fill('Prueba12345!');
 await page.getByRole('button',{name:/CONTINUAR AL PERFIL/i}).click();
 await expect(page.getByText('Paso 2 de 3')).toBeVisible();
 await page.getByPlaceholder('Ej. Barber Studio').fill('Mi Barbería');
 await page.getByPlaceholder('Ej. Bogotá').fill('Bogotá');
 await page.getByRole('button',{name:/CONTINUAR AL PLAN/i}).click();
 await expect(page.getByText('Paso 3 de 3')).toBeVisible();
 await expect(page.getByRole('button',{name:/IR A BARBEROS/i})).toBeVisible();
});
test('Enlaces antiguos con hash permanecen compatibles',async({page})=>{
 await page.goto('/#/login');
 await expect(page.getByTestId('barber-paradise-login')).toBeVisible();
 await page.goto('/#/clientes/inicio');
 await expect(page.getByTestId('barber-paradise-login')).toBeVisible();
 await page.goto('/login');
 await expect(page.getByLabel('Correo electrónico')).toBeVisible();
});
test('Móvil: navegación e imagen sin desbordamiento',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 const appOrigin=new URL(page.url()).origin;
 await expect(page.getByRole('heading',{name:/CREAMOS IDENTIDAD/i})).toBeVisible();
 await page.getByRole('button',{name:'Abrir menú'}).click();
 await page.getByRole('link',{name:'Directorio',exact:true}).click();
 await expect(page).toHaveURL(new URL('/directorio',appOrigin).href);
 await page.goto('/login');
 await expect(page.getByTestId('barber-paradise-login')).toBeVisible();
 const image=page.locator('img[src="/images/barber-paradise-atmosphere.webp"]');
 await expect.poll(()=>image.evaluate(x=>x.complete&&x.naturalWidth>0)).toBe(true);
 const over=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
 expect(over).toBe(false);
});

test('Modo real no muestra perfiles ficticios ni recupera un almacén de demostración',async({page})=>{
 await page.addInitScript(()=>{
   if(!sessionStorage.getItem('qa-old-demo-written')){
     localStorage.setItem('barberos_state_v2',JSON.stringify({users:[{id:'fake-superadmin',role:'superadmin'}]}));
     sessionStorage.setItem('qa-old-demo-written','yes');
   }
 });
 await page.goto('/login');
 await expect(page.getByTestId('barber-paradise-login')).toBeVisible();
 await expect(page.getByText('Cuentas de Desarrollo')).toHaveCount(0);
 await expect(page.getByText('Cambiar Usuario Demo')).toHaveCount(0);
 await expect(page.getByText('Restablecer Datos Demo')).toHaveCount(0);
 await expect(page.getByText('Reiniciar Demo')).toHaveCount(0);
 expect(await page.evaluate(()=>localStorage.getItem('barberos_state_v2'))).toBeNull();
 await page.goto('/login#/admin/inicio');
 await expect(page.getByTestId('barber-paradise-login')).toBeVisible();
});
