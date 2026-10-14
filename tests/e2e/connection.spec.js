import {test,expect} from '@playwright/test';
import {randomBytes,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {cleanupTestTenant} from '../../backend/test/tenant-cleanup.js';

const requireBackend=createRequire(new URL('../../backend/package.json',import.meta.url));
const {createClient}=requireBackend('@supabase/supabase-js');
const pg=requireBackend('pg');
const base='http://127.0.0.1:8188/api/v1';
const dedicated='wrfwhftzaflwhkvkzrjm';
if(!(process.env.SUPABASE_URL||'').includes(dedicated))
 throw Error('Playwright must use dedicated BarberOS Supabase project only');
if(!process.env.ADMIN_DATABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)
 throw Error('Playwright fixture needs ignored backend environment files');

const state={owner:null,customer:null,ownerId:null,customerId:null,
 tenantId:null,slug:null,serviceId:null,barberId:null,productId:null};
const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,
 {auth:{persistSession:false,autoRefreshToken:false}});
const anon=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,
 {auth:{persistSession:false,autoRefreshToken:false}});
const pool=new pg.Pool({connectionString:process.env.ADMIN_DATABASE_URL,max:1,
 connectionTimeoutMillis:8000});
async function seedUser(){
 const email='barberos-itest-'+randomUUID()+'@example.com';
 const password='Ab!'+randomBytes(24).toString('hex');
 const added=await admin.auth.admin.createUser({email,password,email_confirm:true});
 if(added.error)throw added.error;
 const signed=await anon.auth.signInWithPassword({email,password});
 if(signed.error)throw signed.error;
 return {email,password,id:added.data.user.id,jwt:signed.data.session.access_token};
}
async function api(jwt,method,path,payload){
 const r=await fetch(base+path,{method,headers:{
   Authorization:'Bearer '+jwt,...(payload?{'Content-Type':'application/json'}:{})
 },body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(15000)});
 const data=await r.json().catch(()=>null);
 if(!r.ok)throw Error('Fixture '+method+' '+path+' returned '+r.status+
   ' '+String(data?.error||''));
 return data;
}
test.beforeAll(async()=>{
 state.owner=await seedUser();state.ownerId=state.owner.id;
 state.customer=await seedUser();state.customerId=state.customer.id;
 const slug='barberos-itest-'+randomBytes(8).toString('hex');
 state.slug=slug;
 const shop=await api(state.owner.jwt,'POST','/tenants',{
   name:'Barbería E2E del navegador',slug,currency:'COP',timeZone:'America/Bogota'
 });
 state.tenantId=shop.id;
 const tid='/tenants/'+shop.id;
 const barber=await api(state.owner.jwt,'POST',tid+'/barbers',{
   name:'Barbero Chromium',slug:'barbero-chromium'
 });
 state.barberId=barber.id;
 await api(state.owner.jwt,'PUT',tid+'/barbers/'+barber.id+'/hours',{
   intervals:Array.from({length:7},(_,weekday)=>({weekday,startMinute:540,endMinute:1080}))
 });
 const service=await api(state.owner.jwt,'POST',tid+'/services',{
   name:'Corte Chromium',description:'Prueba temporal',category:'haircut',
   priceMinor:25000,durationMinutes:30
 });
 state.serviceId=service.id;
 const product=await api(state.owner.jwt,'POST',tid+'/products',{
   name:'Pomada Chromium',sku:'PW-'+randomBytes(4).toString('hex'),
   description:'Producto solo de prueba',photoUrl:'',category:'beauty',
   priceMinor:12000,costMinor:4500,stock:5,minStock:1,waitingRoomVisible:true
 });
 state.productId=product.id;
});
test.afterAll(async()=>{
 try{
  if(state.tenantId)await cleanupTestTenant(pool,state.tenantId);
 }finally{
  if(state.ownerId)await admin.auth.admin.deleteUser(state.ownerId);
  if(state.customerId)await admin.auth.admin.deleteUser(state.customerId);
  await pool.end();
 }
});
async function login(page,identity){
 await page.goto('/login');
 await expect(page.getByRole('heading',{name:/BIENVENIDO.*DE VUELTA/i}).first()).toBeVisible();
 await page.locator('input[type=email]').fill(identity.email);
 await page.locator('input[type=password]').fill(identity.password);
 await page.getByRole('button',{name:/Iniciar sesión/i}).click();
 await expect(page).toHaveURL(/#\/(?:barberia|clientes|barbero)\//,{timeout:20000});
}
function catchErrors(page){
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message.slice(0,200)));
 return errors;
}
test('Propietario real: login, protección de roles, catálogo y operaciones visibles',async({page})=>{
 const errors=catchErrors(page);
 await login(page,state.owner);
 await expect(page).toHaveURL(new RegExp('/barberia/'+state.slug+'/inicio'),{timeout:20000});
 await expect(page.getByText('Barbería E2E del navegador').first()).toBeVisible();
 await page.goto('/login#/barberia/'+state.slug+'/servicios');
 await expect(page.getByRole('heading',{name:/Servicios & Tarifas/i})).toBeVisible();
 await expect(page.getByText('Corte Chromium').first()).toBeVisible();
 await page.getByRole('button',{name:/Nuevo Servicio/i}).click();
 const modal=page.locator('.fixed.inset-0').last();
 await modal.locator('input[type=text]').first().fill('Servicio añadido con Playwright');
 await modal.locator('textarea').first().fill('Guardado con el formulario original');
 await modal.locator('input[type=number]').first().fill('37000');
 await modal.getByRole('button',{name:/Guardar Servicio/i}).click();
 await expect(page.getByText('Servicio añadido con Playwright').first()).toBeVisible();
 const services=await api(state.owner.jwt,'GET','/tenants/'+state.tenantId+'/services');
 expect(services.some(s=>s.name==='Servicio añadido con Playwright'&&Number(s.price_minor)===37000)).toBe(true);
 await page.goto('/login#/barberia/'+state.slug+'/boutique');
 await expect(page.getByRole('heading',{name:/Inventario de Barbería/i})).toBeVisible();
 await expect(page.getByText('Pomada Chromium').first()).toBeVisible();
 await page.goto('/login#/barberia/'+state.slug+'/agenda');
 await expect(page.getByRole('heading',{name:/Agenda Global/i})).toBeVisible();
 await page.goto('/login#/admin/inicio');
 await expect(page.getByRole('button',{name:/Iniciar sesión/i}).first()).toBeVisible();
 expect(errors).toEqual([]);
});
test('Cliente real: login y catálogo del negocio sin acceso privado',async({page})=>{
 const errors=catchErrors(page);
 await login(page,state.customer);
 await expect(page).toHaveURL(/\/clientes\/inicio/,{timeout:20000});
 await page.goto('/login#/clientes/citas/nueva');
 await expect(page.getByRole('heading',{name:/Elige Barbería o Profesional/i})).toBeVisible();
 await expect(page.getByText('Barbería E2E del navegador').first()).toBeVisible();
 await page.goto('/login#/barberia/'+state.slug+'/boutique');
 await expect(page.getByRole('button',{name:/Iniciar sesión/i}).first()).toBeVisible();
 expect(errors).toEqual([]);
});
test('Propietario real: inventario ajustado desde la boutique original',async({page})=>{
 const errors=catchErrors(page);
 await login(page,state.owner);
 await page.goto('/login#/barberia/'+state.slug+'/boutique');
 await expect(page.getByText('Pomada Chromium').first()).toBeVisible();
 const card=page.locator('div').filter({has:page.getByText('Pomada Chromium',{exact:true})});
 await page.getByRole('button',{name:/Ajustar Inventario/i}).first().click();
 const modal=page.locator('.fixed.inset-0').last();
 await expect(modal.getByText('Ajustar Stock: Pomada Chromium')).toBeVisible();
 await modal.locator('input[type=number]').fill('2');
 await modal.getByRole('button',{name:/Entrada \/ Compra/i}).click();
 await expect(modal).toBeHidden({timeout:18000});
 await expect.poll(async()=>{
   const items=await api(state.owner.jwt,'GET','/tenants/'+state.tenantId+'/products');
   return Number(items.find(x=>x.id===state.productId)?.stock);
 },{timeout:15000}).toBe(7);
 expect(errors).toEqual([]);
});
test('Cliente real: reserva efectiva y pedido con código desde la interfaz',async({page})=>{
 const errors=catchErrors(page);
 await login(page,state.customer);
 await page.goto('/login#/clientes/citas/nueva');
 await expect(page.getByText('Barbería E2E del navegador').first()).toBeVisible();
 await page.getByRole('button',{name:/Continuar a Servicios/i}).click();
 await page.getByRole('button',{name:/Corte Chromium/i}).click();
 await page.getByRole('button',{name:'Continuar',exact:true}).click();
 await page.getByRole('button',{name:/Barbero Chromium/i}).click();
 await page.getByRole('button',{name:/Elegir Horario/i}).click();
 const later=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
 await page.locator('input[type=date]').fill(later);
 await page.getByRole('button',{name:'11:00',exact:true}).click();
 await page.getByRole('button',{name:/Revisar Resumen/i}).click();
 page.once('dialog',async dialog=>{await dialog.accept('3001234567');});
 await page.getByRole('button',{name:/Confirmar Mi Reserva/i}).click();
 await expect(page.getByText('¡Tu Cita Ha Sido Agendada con Éxito!')).toBeVisible({timeout:18000});
 const appointments=await api(state.customer.jwt,'GET','/me/bookings');
 expect(appointments.some(x=>x.tenant_id===state.tenantId&&x.barber_id===state.barberId)).toBe(true);
 await page.goto('/login#/clientes/sala-espera');
 await page.getByRole('button',{name:/Ceras & Cuidado de Barba/i}).click();
 await expect(page.getByText('Pomada Chromium').first()).toBeVisible();
 await page.getByRole('button',{name:/Agregar al Pedido/i}).first().click();
 await page.getByRole('button',{name:/Generar Código de Recogida/i}).click();
 await expect(page.getByText('Pedido Confirmado en Barra')).toBeVisible({timeout:18000});
 const orders=await api(state.customer.jwt,'GET','/me/orders');
 expect(orders.some(x=>x.tenant_id===state.tenantId&&x.pickup_code)).toBe(true);
 expect(errors).toEqual([]);
});
test('Propietario: todas las pantallas principales conservan el diseño sin excepciones JS',async({page})=>{
 const errors=catchErrors(page);
 await login(page,state.owner);
 const routes=['inicio','dashboard','agenda','contabilidad','barberos','clientes','boutique',
   'servicios','perfil','qr','resenas','reportes'];
 for(const route of routes){
   await page.goto('/login#/barberia/'+state.slug+'/'+route);
   await expect(page.locator('main').first()).toBeVisible({timeout:12000});
   await expect(page.getByRole('button',{name:/Iniciar sesión/i})).toHaveCount(0);
 }
 expect(errors).toEqual([]);
});
test('Cliente: todos los módulos del portal abren sin errores de ejecución',async({page})=>{
 const errors=catchErrors(page);
 await login(page,state.customer);
 for(const route of ['inicio','dashboard','citas/nueva','sala-espera','fidelizacion',
   'historial','qr','perfil']){
   await page.goto('/login#/clientes/'+route);
   await expect(page.locator('main').first()).toBeVisible({timeout:12000});
   await expect(page.getByRole('button',{name:/Iniciar sesión/i})).toHaveCount(0);
 }
 expect(errors).toEqual([]);
});
test('No autenticado no obtiene privilegios ni ve accesos de desarrollo',async({page})=>{
 await page.goto('/login');
 await expect(page.getByRole('button',{name:/Iniciar sesión/i}).first()).toBeVisible();
 await expect(page.getByText('Cuentas de Desarrollo')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Owner',exact:true})).toHaveCount(0);
 await page.goto('/login#/barberia/empresa-protegida/inicio');
 await expect(page.getByRole('button',{name:/Iniciar sesión/i}).first()).toBeVisible();
});
