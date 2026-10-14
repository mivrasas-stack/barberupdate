import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import {cleanupTestTenant} from './tenant-cleanup.js';

test('QR enrollment E2E: unique QR, client profile, idempotent independent & shop links, tenant isolation',
 {skip:process.env.RUN_LIVE_QR_INTEGRATION!=='1',timeout:130000},async()=>{
  assert.match(process.env.SUPABASE_URL||'',/wrfwhftzaflwhkvkzrjm/);
  const base=(process.env.API_TEST_BASE_URL||'http://127.0.0.1:8188')+'/api/v1';
  const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,
    {auth:{persistSession:false,autoRefreshToken:false}});
  const clients=[],tenants=[];
  const pool=new pg.Pool({connectionString:process.env.ADMIN_DATABASE_URL,max:1,connectionTimeoutMillis:10000});
  const call=async(jwt,method,path,body,key)=>{
    const r=await fetch(base+path,{method,headers:{
      ...(jwt?{Authorization:'Bearer '+jwt}:{}),...(body?{'Content-Type':'application/json'}:{}),
      ...(key?{'Idempotency-Key':key}:{})
    },body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(14000)});
    return {status:r.status,data:await r.json().catch(()=>null)};
  };
  const check=(r,status,label)=>{
    assert.equal(r.status,status,label+': '+JSON.stringify(r.data).slice(0,180));
    return r.data;
  };
  const user=async()=>{
    const email='barberos-itest-'+randomUUID()+'@example.com';
    const password='Qa!'+randomBytes(20).toString('hex');
    const created=await admin.auth.admin.createUser({email,password,email_confirm:true});
    assert.ifError(created.error);clients.push(created.data.user.id);
    const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,
      {auth:{persistSession:false,autoRefreshToken:false}});
    const session=await client.auth.signInWithPassword({email,password});
    assert.ifError(session.error);
    return {id:created.data.user.id,jwt:session.data.session.access_token};
  };
  try{
    const owner=await user(),pro=await user(),customer=await user();
    const create=async(person,name)=>{
      const slug='barberos-itest-'+randomBytes(8).toString('hex');
      const row=check(await call(person.jwt,'POST','/tenants',{
        name,slug,currency:'COP',timeZone:'America/Bogota'
      }),201,'Fixture creates tenant');
      tenants.push(row.id);
      return row;
    };
    const shop=await create(owner,'QA Barbería con QR');
    const professional=await create(pro,'QA Independiente con QR');
    const modified=await pool.query("UPDATE public.tenants SET business_kind='independent' WHERE id=$1 AND owner_user_id=$2 RETURNING id",[professional.id,pro.id]);
    assert.equal(modified.rowCount,1);
    const independentBarber=await pool.query(
      "INSERT INTO public.barbers(tenant_id,user_id,name,slug) VALUES($1,$2,'Profesional QA','profesional-qa') RETURNING id",
      [professional.id,pro.id]);
    const barberId=independentBarber.rows[0].id;
    check(await call(pro.jwt,'PUT','/tenants/'+professional.id+'/barbers/'+barberId+'/hours',{
      intervals:Array.from({length:7},(_,weekday)=>({weekday,startMinute:540,endMinute:1080}))
    }),200,'Independent professional schedule');
    const barberService=check(await call(pro.jwt,'POST','/tenants/'+professional.id+'/services',{
      name:'Corte profesional independiente',category:'haircut',description:'',
      priceMinor:24000,durationMinutes:30
    }),201,'Independent professional service');
    const shopQR=check(await call(owner.jwt,'GET','/tenants/'+shop.id+'/link-code'),200,'Owner QR code');
    const proQR=check(await call(pro.jwt,'GET','/tenants/'+professional.id+'/link-code'),200,'Independent QR code');
    assert.match(shopQR.link_code,/^[A-F0-9]{24}$/);
    assert.match(proQR.link_code,/^[A-F0-9]{24}$/);
    assert.notEqual(shopQR.link_code,proQR.link_code);
    check(await call(customer.jwt,'GET','/tenants/'+shop.id+'/link-code'),403,'Customer cannot read private QR endpoint');
    check(await call(pro.jwt,'GET','/tenants/'+shop.id+'/link-code'),403,'Other owner cannot read private QR endpoint');
    const published=check(await call(null,'GET','/public/links/'+shopQR.link_code),200,'Public QR lookup');
    assert.equal(published.name,'QA Barbería con QR');
    assert.equal(published.tenant_id,shop.id);
    check(await call(null,'GET','/public/links/'+'F'.repeat(24)),404,'Unknown QR rejected');
    const profile={fullName:'Cliente Vinculado Real',phone:'+57 300 123 4567'};
    const linkedShop=check(await call(customer.jwt,'POST','/me/links',{code:shopQR.link_code,...profile}),200,'Join barber shop');
    assert.equal(linkedShop.tenantId,shop.id);
    const linkedPro=check(await call(customer.jwt,'POST','/me/links',{code:proQR.link_code,...profile}),200,'Join independent');
    assert.equal(linkedPro.kind,'independent');
    check(await call(customer.jwt,'POST','/me/links',{code:shopQR.link_code,...profile}),200,'Idempotent repeat');
    const links=check(await call(customer.jwt,'GET','/me/links'),200,'Personal associations');
    assert.equal(links.items.length,2,'Duplicate QR should not create duplicate links');
    assert.equal(links.profile.full_name,profile.fullName);
    assert.equal(links.profile.phone,profile.phone);
    assert.ok(links.items.some(x=>x.tenant_id===shop.id&&x.business_kind==='barbershop'));
    assert.ok(links.items.some(x=>x.tenant_id===professional.id&&x.barber_name==='Profesional QA'));
    const futureDay=new Date(Date.now()+18*86400000).toISOString().slice(0,10);
    const available=check(await call(null,'GET','/public/tenants/'+professional.id+
       '/availability?barberId='+barberId+'&serviceId='+barberService.id+'&date='+futureDay),
       200,'Independent QR barber availability');
    assert.ok(available.slots.length>0,'Independent professional should have bookable time');
    const booking=check(await call(customer.jwt,'POST','/tenants/'+professional.id+'/bookings',{
      barberId,serviceId:barberService.id,startsAt:available.slots[0].starts_at,
      customerName:profile.fullName,customerPhone:profile.phone
    },'qr-booking-'+randomBytes(12).toString('hex')),201,'Linked customer booked independent professional');
    assert.equal(booking.tenant_id,professional.id);
    const mine=check(await call(customer.jwt,'GET','/me/bookings'),200,'Customer booking view');
    assert.ok(mine.some(x=>x.id===booking.id));
    const isolation=check(await call(owner.jwt,'GET','/me/links'),200,'Other user has no customer links');
    assert.equal(isolation.items.length,0);
    check(await call(owner.jwt,'POST','/me/links',{code:proQR.link_code,...profile}),403,'Owner cannot impersonate client');
    // Employed barber QR verification
    const shopBarberUser=await user();
    await pool.query("INSERT INTO public.tenant_members(tenant_id,user_id,role) VALUES($1,$2,'barber')",
      [shop.id,shopBarberUser.id]);
    const shopBarber=await pool.query(
      "INSERT INTO public.barbers(tenant_id,user_id,name,slug) VALUES($1,$2,'Barbero Empleado QA','barbero-empleado-qa') RETURNING id,link_code",
      [shop.id,shopBarberUser.id]);
    const shopBarberId=shopBarber.rows[0].id;
    const employeeQR=check(await call(shopBarberUser.jwt,'GET','/tenants/'+shop.id+'/link-code'),200,'Employed barber gets their QR');
    assert.equal(employeeQR.link_type,'barber');
    assert.equal(employeeQR.barber_name,'Barbero Empleado QA');
    assert.equal(employeeQR.link_code,shopBarber.rows[0].link_code);

    const pubEmployeeQR=check(await call(null,'GET','/public/links/'+employeeQR.link_code),200,'Public lookup for employee QR');
    assert.equal(pubEmployeeQR.link_type,'barber');
    assert.equal(pubEmployeeQR.barber_name,'Barbero Empleado QA');
    assert.equal(pubEmployeeQR.tenant_id,shop.id);

    // Customer links specifically to the barber
    const linkBarberOnly=check(await call(customer.jwt,'POST','/me/links',{
      code:employeeQR.link_code,linkScope:'barber',...profile
    }),200,'Link customer with barber scope');
    assert.equal(linkBarberOnly.barberId,shopBarberId);
    assert.equal(linkBarberOnly.linkScope,'barber');

    // Customer links with both
    const linkBoth=check(await call(customer.jwt,'POST','/me/links',{
      code:employeeQR.link_code,linkScope:'both',...profile
    }),200,'Link customer with both scope');
    assert.equal(linkBoth.barberId,shopBarberId);
    assert.equal(linkBoth.linkScope,'both');

    const count=await pool.query('SELECT count(*)::integer AS n FROM public.customer_links WHERE user_id=$1',[customer.id]);
    assert.equal(count.rows[0].n,2);
  }finally{
    for(const tenant of tenants.reverse())await cleanupTestTenant(pool,tenant).catch(e=>console.log('TENANT_CLEANUP_ERROR='+e.message.slice(0,140)));
    for(const id of clients.reverse()){
      const result=await admin.auth.admin.deleteUser(id);
      assert.ifError(result.error);
    }
    await pool.end();
  }
});
