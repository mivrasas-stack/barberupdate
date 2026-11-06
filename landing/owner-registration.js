/** Owner onboarding uses BarberNow's own PostgreSQL sessions and WhatsApp OTP.
 * No Supabase SDK, SMTP or third-party auth credentials are needed. */
const sessionKey='barberos_auth_session_v1';
const errText=(data,fallback)=>data?.msg||data?.error_description||data?.message||data?.error||fallback;

export async function createOwnerSpace({person,shop,existingAccount=false,alreadySignedUp=false,
 challengeId='',otpCode='',apiBase='/api/v1',fetcher=fetch,storage=sessionStorage}){
 const api=String(apiBase||'/api/v1').replace(/\/$/,'');
 const email=String(person.email||'').trim().toLowerCase();
 const password=String(person.password||'');
 const request=async(path,payload)=>{
  const res=await fetcher(api+'/auth/'+path,{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify(payload),cache:'no-store',credentials:'omit'
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(errText(data,'No fue posible validar la cuenta.'));
  return data;
 };
 if(!existingAccount&&!alreadySignedUp){
  const created=await request('signup',{email,password,data:{
   full_name:String(person.name||'').trim(),phone:String(person.phone||'').trim()
  }});
  if(!created.challengeId)throw Error('No se pudo generar el código de WhatsApp.');
  return {verificationRequired:true,challengeId:created.challengeId,signedUp:true};
 }
 if(!existingAccount&&alreadySignedUp&&(!challengeId||!/^[0-9]{8}$/.test(otpCode)))
  throw Error('Escribe el código de WhatsApp de 8 dígitos.');
 let auth=null;
 if(!existingAccount&&alreadySignedUp){
  try{await request('whatsapp/verify',{challengeId,code:otpCode,purpose:'signup'});}
  catch(error){
   // A retry after a committed verification may produce "used"; only a
   // successful password login of the exact same user may recover that state.
   try{auth=await request('token?grant_type=password',{email,password});}
   catch{throw error;}
  }
 }
 if(!auth)auth=await request('token?grant_type=password',{email,password});
 if(!auth.access_token||!auth.refresh_token)throw Error('No se pudo iniciar la sesión de BarberNow.');
 const headers={Authorization:'Bearer '+auth.access_token};
 async function existingOwnedSpace(){
  try{
   const res=await fetcher(api+'/tenants',{headers,cache:'no-store',credentials:'omit'});
   if(!res.ok)return null;
   const list=await res.json().catch(()=>[]);
   const owned=Array.isArray(list)?list.find(t=>t.role==='owner'&&t.id&&t.slug):null;
   return owned?{tenantId:owned.id,slug:owned.slug,role:'owner',created:false}:null;
  }catch{return null;}
 }
 let outcome=null,failedMessage='';
 try{
  const res=await fetcher(api+'/owner-onboarding',{
   method:'POST',headers:{...headers,'Content-Type':'application/json'},
   body:JSON.stringify({ownerName:person.name,phone:person.phone,
    shopName:shop.business,city:shop.city,address:shop.address||''}),
   cache:'no-store',credentials:'omit'
  });
  const data=await res.json().catch(()=>null);
  if(res.ok&&data?.role==='owner'&&data?.tenantId&&data?.slug)outcome=data;
  else failedMessage=errText(data,'La activación de la barbería no se completó');
 }catch{failedMessage='Se interrumpió la conexión durante la activación.';}
 if(!outcome)outcome=await existingOwnedSpace();
 if(!outcome)throw Error(failedMessage||'No fue posible confirmar tu barbería.');
 storage.setItem(sessionKey,JSON.stringify({
  access_token:auth.access_token,refresh_token:auth.refresh_token,
  expires_at:Date.now()+Number(auth.expires_in||3600)*1000
 }));
 return outcome;
}

export function mountOwnerRegistration({form,
 apiBase=import.meta.env?.VITE_API_BASE_URL||'/api/v1',fetcher=fetch,storage=sessionStorage,
 onCompleted=result=>window.location.assign('/#/barberia/'+encodeURIComponent(result.slug)+'/inicio')}={}){
 if(!form)return;
 const fields=form.querySelector('#form-fields');
 const heading=document.querySelector('#form-heading');
 const tag=document.querySelector('#step-tag');
 const desc=document.querySelector('#form-desc');
 const stepText=document.querySelector('#step-num');
 const submit=form.querySelector('#signup-next');
 const status=document.querySelector('#signup-status');
 const change=form.querySelector('#signup-existing');
 let step=1,busy=false,signedUp=false,existingAccount=false,person=null,shop=null,challengeId='';
 function notice(message,error=false){
   status.textContent=message;status.className='registration-status '+(error?'error':'info');
 }
 const top=()=>window.scrollTo({top:0,behavior:'smooth'});
 change?.addEventListener('click',()=>{
   if(busy||step!==1)return;
   existingAccount=!existingAccount;
   change.textContent=existingAccount?'Crear una cuenta nueva':'Ya tengo una cuenta: usar mis credenciales';
   const password=form.querySelector('[name="password"]');
   const confirmation=form.querySelector('[name="confirmPassword"]');
   if(password)password.minLength=existingAccount?1:12;
   if(confirmation){
     confirmation.required=!existingAccount;
     confirmation.minLength=existingAccount?0:12;
     confirmation.closest('label')?.classList.toggle('registration-hidden',existingAccount);
   }
   notice(existingAccount?'Ingresaremos con tu cuenta existente y crearemos tu barbería como propietario.':'Crearemos tu cuenta y la barbería con tus credenciales nuevas.');
 });
 form.addEventListener('submit',async event=>{
   event.preventDefault();
   if(busy)return;
   status.textContent='';status.className='registration-status';
   if(step===1){
     const d=new FormData(form);
     if(!existingAccount&&String(d.get('password')||'').length<12)return notice('La contraseña debe tener al menos 12 caracteres.',true);
     if(!existingAccount&&d.get('password')!==d.get('confirmPassword'))return notice('Las contraseñas no coinciden.',true);
     person={name:String(d.get('name')||'').trim(),email:String(d.get('email')||'').trim(),
       phone:String(d.get('phone')||'').trim(),password:String(d.get('password')||'')};
     step=2;stepText.textContent='Paso 2 de 4';tag.textContent='Datos de la barbería';
     heading.textContent='PERSONALIZA TU BARBERÍA';
     desc.textContent='Serás propietario de esta barbería. Podrás incorporar barberos empleados desde tu panel.';
     fields.innerHTML='<label>Nombre de tu barbería *<input name="business" required minlength="2" maxlength="120" placeholder="Ej. Barber Studio" autocomplete="organization"/></label><label>Ciudad *<input name="city" required minlength="2" maxlength="120" placeholder="Ej. Bogotá" autocomplete="address-level2"/></label><label>Dirección (opcional)<input name="address" maxlength="300" placeholder="Ej. Calle 10 # 12-34" autocomplete="street-address"/></label>';
     change.classList.add('registration-hidden');submit.textContent='REVISAR MI BARBERÍA →';top();return;
   }
   if(step===2){
     const d=new FormData(form);
     shop={business:String(d.get('business')||'').trim(),city:String(d.get('city')||'').trim(),
       address:String(d.get('address')||'').trim()};
     step=3;stepText.textContent='Paso 3 de 4';tag.textContent='Confirmación';
     heading.textContent='ACTIVA TU BARBERÍA';
     desc.textContent='Se crearán tu cuenta personal y tu barbería, con permisos de propietario.';
     fields.innerHTML='<div class="register-success"><strong>Resumen del registro</strong><p id="owner-summary" class="owner-summary"></p><small>Podrás gestionar agenda, servicios y personal desde tu panel. No se realiza ningún cobro en este paso.</small></div>';
     document.getElementById('owner-summary').textContent=person.name+' · '+person.email+' · '+shop.business+' ('+shop.city+')';
     submit.textContent='CREAR MI CUENTA Y BARBERÍA →';top();return;
   }
   busy=true;submit.disabled=true;change.disabled=true;submit.textContent='CREANDO BARBERÍA…';
   notice('Validando la cuenta y creando tu barbería…');
   try{
     const otpCode=step===4?String(new FormData(form).get('otpCode')||'').trim():'';
     const activated=await createOwnerSpace({person,shop,existingAccount,
       alreadySignedUp:signedUp,challengeId,otpCode,apiBase,fetcher,storage});
     if(activated.verificationRequired){
       challengeId=activated.challengeId;
       signedUp=true;
       step=4;
       stepText.textContent='Paso 4 de 4';
       tag.textContent='Verificación de seguridad';
       heading.textContent='CONFIRMA TU WHATSAPP';
       desc.textContent='Enviamos un código de seguridad a tu celular. El código vence en 5 minutos y solamente se usa una vez.';
       fields.innerHTML='<label>Código de WhatsApp (8 dígitos) *<input name="otpCode" required minlength="8" maxlength="8" pattern="[0-9]{8}" autocomplete="one-time-code" inputmode="numeric" placeholder="12345678"/></label>';
       submit.textContent='VERIFICAR Y ACTIVAR MI BARBERÍA →';
       notice('Revisa tu WhatsApp y escribe el código recibido.');
       top();
       return;
     }
     person.password='';
     notice('Tu barbería está creada. Abriendo tu panel de propietario…');
     onCompleted(activated);
   }catch(error){
     if(error.signedUp)signedUp=true;
     notice(error?.message||'No fue posible completar el registro.',true);
     submit.textContent=step===4?'VERIFICAR CÓDIGO OTRA VEZ →':'REINTENTAR ACTIVACIÓN →';
   }finally{busy=false;submit.disabled=false;change.disabled=false;}
 });
}

[executed on device: vmi3669516 (22a9c8cd-8866-4186-9071-dab9301dff16)]