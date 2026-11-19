import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

test('login shows and hides the typed password without clearing it or submitting',async({page})=>{
  await page.goto('/login');
  const field=page.locator('#barber-password');
  await field.fill('MiClaveDePrueba2026!');
  await expect(field).toHaveAttribute('type','password');
  const show=page.getByRole('button',{name:'Mostrar contraseña',exact:true});
  await expect(show).toBeVisible();
  await expect(show).toHaveAttribute('type','button');
  await show.click();
  await expect(field).toHaveAttribute('type','text');
  await expect(field).toHaveValue('MiClaveDePrueba2026!');
  const hide=page.getByRole('button',{name:'Ocultar contraseña',exact:true});
  await expect(hide).toHaveAttribute('aria-pressed','true');
  await hide.click();
  await expect(field).toHaveAttribute('type','password');
  await expect(field).toHaveValue('MiClaveDePrueba2026!');
  await expect(page.getByTestId('barbernow-login')).toBeVisible();
});

test('mobile login keeps the reveal control visible without horizontal overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/login');
  const toggle=page.getByRole('button',{name:'Mostrar contraseña',exact:true});
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.locator('#barber-password')).toHaveAttribute('type','text');
  const overflows=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);
  expect(overflows).toBe(false);
});

test('owner registration allows independent password/confirmation inspection',async({page})=>{
  await page.setContent('<form id="signup-form"><label>Contraseña<input name="password" type="password" value="ClaveTest123!"></label><label>Confirmar<input name="confirmPassword" type="password" value="ClaveTest123!"></label><button type="submit">Siguiente</button></form>');
  const source=readFileSync(resolve(dirname(fileURLToPath(import.meta.url)),'../../landing/password-visibility.js'),'utf8');
  await page.evaluate(async script=>{
    const blob=new Blob([script],{type:'text/javascript'});
    const url=URL.createObjectURL(blob);
    try{
      const module=await import(url);
      module.attachPasswordVisibility(document.getElementById('signup-form'));
    }finally{URL.revokeObjectURL(url);}
  },source);
  const first=page.locator('[name="password"]');
  const confirm=page.locator('[name="confirmPassword"]');
  await expect(first).toHaveAttribute('type','password');
  await page.getByRole('button',{name:'Mostrar contraseña',exact:true}).click();
  await expect(first).toHaveAttribute('type','text');
  await expect(confirm).toHaveAttribute('type','password');
  await page.getByRole('button',{name:'Mostrar confirmación de contraseña',exact:true}).click();
  await expect(confirm).toHaveAttribute('type','text');
  await expect(confirm).toHaveValue('ClaveTest123!');
  await page.getByRole('button',{name:'Ocultar contraseña',exact:true}).click();
  await expect(first).toHaveAttribute('type','password');
  await expect(page.getByRole('button',{name:'Mostrar contraseña',exact:true})).toHaveAttribute('type','button');
});

[executed on device: vmi3669516 (22a9c8cd-8866-4186-9071-dab9301dff16)]