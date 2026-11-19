import {test,expect} from '@playwright/test';

test('recovery offers a real resend control with 60-second cooldown and replaces the previous challenge',async({page})=>{
 await page.clock.install();
 let requests=0;
 await page.route('**/api/v1/auth/whatsapp/recovery/start',async route=>{
  requests++;
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   challengeId:requests===1?'11111111-1111-4111-8111-111111111111':'22222222-2222-4222-8222-222222222222',
   expiresInSeconds:300,message:'Solicitud recibida'
  })});
 });
 await page.goto('/login');
 await page.getByLabel('Correo electrónico').fill('test@example.invalid');
 await page.getByRole('button',{name:'¿Olvidaste tu contraseña?'}).click();
 await expect(page.getByRole('heading',{name:'Verifica tu WhatsApp'})).toBeVisible();
 const resend=page.getByRole('button',{name:/Reenviar código por WhatsApp/});
 await expect(resend).toBeVisible();
 await expect(resend).toBeDisabled();
 await expect(page.getByText(/celular aparece en otras cuentas/)).toBeVisible();
 expect(requests).toBe(1);
 await page.clock.runFor(60000);
 await expect(resend).toBeEnabled();
 await page.locator('#recovery-whatsapp-code').fill('12345678');
 await resend.click();
 await expect(resend).toBeDisabled();
 await expect(page.locator('#recovery-whatsapp-code')).toHaveValue('');
 expect(requests).toBe(2);
});