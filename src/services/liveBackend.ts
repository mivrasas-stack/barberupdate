import type {
  Appointment, Barber, Barbershop, Product, Service, SubscriptionPlan, Transaction, Order, User, UserRole, CashClosing, Review, LoyaltyAccount, LoyaltyBalance, LoyaltyReward, LoyaltyRedemption
} from '../types';

type Db = Record<string, unknown>;
const val=(o:Db,k:string)=>o[k];
const txt=(o:Db,k:string,def='')=>String(val(o,k)??def);
const num=(o:Db,k:string,def=0)=>Number(val(o,k)??def);
const arr=(v:unknown):Db[]=>Array.isArray(v)?v as Db[]:[];
// BarberOS currently stores COP integer amounts in *_minor fields (e.g. 45000 = COP 45,000).
const money=(o:Db,k:string)=>num(o,k);
export const isLiveBackend=import.meta.env.VITE_BACKEND_MODE==='live';
const apiOrigin=String(import.meta.env.VITE_API_BASE_URL||'/api/v1').replace(/\/$/,'');
const supabaseUrl=String(import.meta.env.VITE_SUPABASE_URL||'').replace(/\/$/,'');
const supabasePublicKey=String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'');
const storageKey='barberos_auth_session_v1';
const authSetupKey='barbernow_password_setup_v1';
export function isPasswordSetupPending(){return isLiveBackend && !!sessionStorage.getItem(authSetupKey);}
export function cancelPasswordSetup(){sessionStorage.removeItem(authSetupKey);clearSession();}
export function consumeAuthRedirect(){
  if(!isLiveBackend)return;
  const fragment=new URLSearchParams(window.location.hash.replace(/^#/,''));
  const flow=fragment.get('type');
  if(flow!=='invite'&&flow!=='recovery')return;
  const access_token=fragment.get('access_token'),refresh_token=fragment.get('refresh_token');
  history.replaceState(null,'',window.location.pathname+window.location.search+'#/login');
  if(!access_token||!refresh_token)return;
  const expires_in=Number(fragment.get('expires_in')||3600);
  receiveToken({access_token,refresh_token,expires_in});
  sessionStorage.setItem(authSetupKey,flow);
}
export async function savePasswordFromLink(password:string){
  if(!isPasswordSetupPending())throw Error('Abre un enlace válido de invitación o recuperación.');
  if(password.length<12)throw Error('La contraseña debe tener al menos 12 caracteres.');
  const jwt=await token();
  const response=await fetch(supabaseUrl+'/auth/v1/user',{
    method:'PUT',headers:{apikey:supabasePublicKey,Authorization:'Bearer '+jwt,'Content-Type':'application/json'},
    body:JSON.stringify({password})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.msg||data.error_description||data.message||'No se pudo establecer la contraseña.');
  sessionStorage.removeItem(authSetupKey);
  clearSession();
  return String(data.email||'');
}

type Session={access_token:string;refresh_token:string;expires_at:number};
let session:Session|null=null;

function storeSession(value:Session|null){
  session=value;
  if(value)sessionStorage.setItem(storageKey,JSON.stringify(value));
  else sessionStorage.removeItem(storageKey);
}
const userCacheKey='barberos_cached_user_v1';
export function getCachedUser():User|null{
  try{
    const raw=sessionStorage.getItem(userCacheKey);
    return raw?JSON.parse(raw) as User:null;
  }catch{return null;}
}
export function setCachedUser(user:User|null){
  if(user)sessionStorage.setItem(userCacheKey,JSON.stringify(user));
  else sessionStorage.removeItem(userCacheKey);
}
export function clearSession(){
  storeSession(null);
  setCachedUser(null);
}
export function hasSession(){return !isPasswordSetupPending() && (!!session||!!sessionStorage.getItem(storageKey));}
async function authCall(path:string,payload:object){
  if(!supabaseUrl||!supabasePublicKey)throw Error('Faltan variables públicas de Supabase para conectar BarberOS.');
  const result=await fetch(supabaseUrl+'/auth/v1/'+path,{
    method:'POST',headers:{apikey:supabasePublicKey,'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  });
  const data=await result.json().catch(()=>({}));
  if(!result.ok){
    if(result.status===429)throw Error(data?.code==='over_email_send_rate_limit'?'Se alcanzó el límite de correos de confirmación. Intenta más tarde o contacta al administrador.':'Demasiados intentos de autenticación. Espera unos minutos antes de reintentar.');
    throw Error(data.msg||data.error_description||data.message||data.error||'No se pudo iniciar sesión.');
  }
  return data;
}
function receiveToken(data:any){
  if(!data.access_token||!data.refresh_token)throw Error('Supabase no entregó una sesión válida.');
  storeSession({access_token:data.access_token,refresh_token:data.refresh_token,
    expires_at:Date.now()+Number(data.expires_in||3600)*1000});
}
export async function signIn(email:string,password:string){
  receiveToken(await authCall('token?grant_type=password',{email,password}));
}
// Login-only actions: never expose privileged Supabase credentials to the browser.
export async function registerWithEmail(email:string,password:string,profile?:{fullName:string;phone:string}){
  await authCall('signup',{email,password,...(profile?{data:{full_name:profile.fullName,phone:profile.phone}}:{})});
}
// El profesional conserva sus datos de contacto en Supabase Auth, no en la barbería.
export async function updateAuthProfile(profile:{fullName:string;phone:string}){
  const jwt=await token();
  const response=await fetch(supabaseUrl+'/auth/v1/user',{
    method:'PUT',
    headers:{apikey:supabasePublicKey,Authorization:'Bearer '+jwt,'Content-Type':'application/json'},
    body:JSON.stringify({data:{full_name:profile.fullName,phone:profile.phone}})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.msg||data.error_description||data.message||data.error||'No se pudo guardar el perfil de contacto.');
}

export type ClientCutPreferences={style:string;topLength:string;beard:string;notes:string};
export type ClientAuthProfile={name:string;email:string;phone:string;avatar:string;preferences:ClientCutPreferences};
export async function getClientAuthProfile():Promise<ClientAuthProfile>{
 const jwt=await token();
 const res=await fetch(supabaseUrl+'/auth/v1/user',{headers:{apikey:supabasePublicKey,Authorization:'Bearer '+jwt}});
 const json=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(json.msg||json.message||'No se pudo cargar tu perfil.');
 const md=json.user_metadata||{};
 const cuts=md.cut_preferences||{};
 return {name:String(md.full_name||md.name||''),email:String(json.email||''),phone:String(md.phone||''),
   avatar:String(md.avatar_url||''),preferences:{
     style:String(cuts.style||''),topLength:String(cuts.topLength||''),beard:String(cuts.beard||''),notes:String(cuts.notes||'')
   }};
}
export async function saveClientAuthProfile(input:ClientAuthProfile,originalEmail:string):Promise<void>{
 const jwt=await token();
 const body:{email?:string;data:{full_name:string;phone:string;cut_preferences:ClientCutPreferences}}={
  data:{full_name:input.name.trim(),phone:input.phone.trim(),cut_preferences:input.preferences}
 };
 // Avoid asking Supabase to reconfirm an unchanged email on every profile save.
 if(input.email.trim().toLowerCase()!==originalEmail.trim().toLowerCase()){
  body.email=input.email.trim().toLowerCase();
 }
 const response=await fetch(supabaseUrl+'/auth/v1/user',{method:'PUT',headers:{
  apikey:supabasePublicKey,Authorization:'Bearer '+jwt,'Content-Type':'application/json'
 },body:JSON.stringify(body)});
 const json=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(json.msg||json.error_description||json.message||'No se pudo guardar tu perfil.');
}
export async function updateAccountAvatar(url:string):Promise<void>{
 const jwt=await token();
 const response=await fetch(supabaseUrl+'/auth/v1/user',{
  method:'PUT',headers:{apikey:supabasePublicKey,Authorization:'Bearer '+jwt,'Content-Type':'application/json'},
  body:JSON.stringify({data:{avatar_url:url}})
 });
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(result.msg||result.message||'No se pudo guardar la foto en tu cuenta.');
}
export async function updateAccountContact(input:{name:string;phone:string;email:string;originalEmail:string}):Promise<void>{
 const jwt=await token();
 const body:{email?:string;data:{full_name:string;phone:string}}={
  data:{full_name:input.name.trim(),phone:input.phone.trim()}
 };
 if(input.originalEmail.toLowerCase()!==input.email.trim().toLowerCase())
  body.email=input.email.trim().toLowerCase();
 const response=await fetch(supabaseUrl+'/auth/v1/user',{
  method:'PUT',headers:{apikey:supabasePublicKey,Authorization:'Bearer '+jwt,'Content-Type':'application/json'},
  body:JSON.stringify(body)
 });
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(result.msg||result.message||'No se pudieron guardar los datos personales.');
}
export async function saveProfessionalProfile(tenantId:string,barberId:string,input:{
 name:string;bio:string;specialties:string[];experienceYears:number;instagramUrl:string;professionalPhone:string
}){
 return backendRequest<Db>('/tenants/'+encodeURIComponent(tenantId)+'/barbers/'+encodeURIComponent(barberId)+'/professional-profile',{
  method:'PATCH',body:JSON.stringify(input)
 });
}
export async function requestPasswordReset(email:string){
  await authCall('recover',{email});
}
async function token(){
  if(!session){
    try{session=JSON.parse(sessionStorage.getItem(storageKey)||'null') as Session|null;}
    catch{clearSession();}
  }
  if(!session)throw Error('Inicia sesión con tu correo y contraseña de Supabase.');
  if(Date.now()>=session.expires_at-60_000){
    try{receiveToken(await authCall('token?grant_type=refresh_token',{refresh_token:session.refresh_token}));}
    catch{clearSession();throw Error('Tu sesión expiró. Inicia sesión de nuevo.');}
  }
  return session.access_token;
}
export async function signOut(){
  if(!session)return;
  try{
    const jwt=await token();
    await fetch(supabaseUrl+'/auth/v1/logout',{method:'POST',
      headers:{apikey:supabasePublicKey,Authorization:'Bearer '+jwt}});
  }finally{clearSession();}
}
export async function backendRequest<T>(path:string,options:RequestInit={},key?:string):Promise<T>{
  const jwt=await token();
  const headers=new Headers(options.headers);
  headers.set('Authorization','Bearer '+jwt);
  if(options.body)headers.set('Content-Type','application/json');
  if(key)headers.set('Idempotency-Key',key);
  const response=await fetch(apiOrigin+path,{...options,headers});
  const body=await response.json().catch(()=>null);
  if(!response.ok)throw Error(body?.error||'Error del backend ('+response.status+')');
  return body as T;
}
function slugFor(text:string){return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'barberia';}
function dayParts(raw:string,zone='America/Bogota'){
  const d=new Date(raw);
  const pieces=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(d);
  const pick=(k:string)=>pieces.find(p=>p.type===k)?.value||'00';
  return {date:pick('year')+'-'+pick('month')+'-'+pick('day'),time:pick('hour')+':'+pick('minute')};
}
export function mapShop(r:Db,userId:string):Barbershop{
  return {
    id:txt(r,'id'),slug:txt(r,'slug'),name:txt(r,'name'),ownerId:txt(r,'owner_user_id',userId),
    tagline:txt(r,'tagline'),logo:txt(r,'logo_url'),coverImage:txt(r,'cover_url'),phone:txt(r,'phone'),email:txt(r,'email'),address:txt(r,'address'),city:txt(r,'city'),
    planId:'',subscriptionStatus:'trial',subscriptionRenewsAt:'',rating:0,reviewsCount:0,
    openingHours:(val(r,'opening_hours') as Barbershop['openingHours'])||{days:'',open:'',close:''},socialLinks:(val(r,'social_links') as Barbershop['socialLinks'])||{},
     coordinates:val(r,'latitude')!=null&&val(r,'longitude')!=null?{lat:num(r,'latitude'),lng:num(r,'longitude')}:undefined,
     portfolio:Array.isArray(r.portfolio)?r.portfolio as string[]:[], 
    publicCode:txt(r,'slug'),businessKind:txt(r,'business_kind','barbershop') as Barbershop['businessKind'],createdAt:txt(r,'created_at',new Date().toISOString())
  };
}
export function mapBarber(r:Db,tenant:string):Barber{
  return {
    id:txt(r,'id'),businessId:tenant,slug:txt(r,'slug'),userId:txt(r,'user_id')||undefined,
    name:txt(r,'name'),photo:txt(r,'photo_url'),phone:txt(r,'professional_phone'),email:'',
    specialties:Array.isArray(r.specialties)?r.specialties.map(v=>String(v)):[],
    experienceYears:num(r,'experience_years'),instagramUrl:txt(r,'instagram_url'),
    bio:txt(r,'bio'),commissionRate:num(r,'commission_rate'),
     contractType:txt(r,'contract_type','commission') as Barber['contractType'],
     chairRentalFee:money(r,'chair_rental_fee'),
     chairRentalPeriod:txt(r,'chair_rental_period','monthly') as Barber['chairRentalPeriod'],
    status:txt(r,'status','active')==='active'?'active':'inactive',
    rating:0,reviewsCount:0,portfolio:Array.isArray(r.portfolio)?r.portfolio as string[]:[],workDays:[],workHours:{start:'09:00',end:'18:00'},
    isIndependent:false,publicCode:txt(r,'slug')
  };
}
export function mapService(r:Db,tenant:string):Service{
  const category=txt(r,'category','haircut') as Service['category'];
  return {
    id:txt(r,'id'),businessId:tenant,name:txt(r,'name'),description:txt(r,'description'),
    price:money(r,'price_minor'),durationMinutes:num(r,'duration_minutes',30),
    category:['haircut','beard','combo','eyebrows','treatments','special'].includes(category)?category:'special',
    barberIds:[],isActive:val(r,'is_active')!==false,earnsLoyaltyPoints:val(r,'earns_loyalty_points')===true,order:0
  };
}
export function mapReward(r:Db):LoyaltyReward{
 return {id:txt(r,'id'),tenantId:txt(r,'tenant_id'),title:txt(r,'title'),
  description:txt(r,'description'),pointsCost:num(r,'points_cost'),
  isActive:val(r,'is_active')!==false,availablePoints:num(r,'available_points')};
}
export function mapRedemption(r:Db):LoyaltyRedemption{
 return {id:txt(r,'id'),tenantId:txt(r,'tenant_id'),rewardId:txt(r,'reward_id'),
  title:txt(r,'title'),pointsCost:num(r,'points_cost'),
  status:txt(r,'status','pending') as LoyaltyRedemption['status'],
  createdAt:txt(r,'created_at'),userId:txt(r,'user_id')||undefined};
}
export function mapReview(r:Db,customerId=''):Review{
 return {id:txt(r,'id'),businessId:txt(r,'tenant_id'),barberId:txt(r,'barber_id'),
  customerId:txt(r,'customer_user_id',customerId),customerName:txt(r,'customer_name','Cliente'),
  customerAvatar:'',appointmentId:txt(r,'appointment_id'),rating:num(r,'rating'),
  comment:txt(r,'comment'),date:txt(r,'created_at').slice(0,10)};
}
export function mapProduct(r:Db,tenant:string):Product{
  return {
    id:txt(r,'id'),businessId:tenant,name:txt(r,'name'),sku:txt(r,'sku'),
    description:txt(r,'description'),photo:txt(r,'photo_url'),
    category:txt(r,'category','beauty') as Product['category'],
    price:money(r,'price_minor'),cost:money(r,'cost_minor'),
    stock:num(r,'stock'),minStock:num(r,'min_stock'),
    isActive:val(r,'is_active')!==false,isVisibleInWaitingRoom:val(r,'waiting_room_visible')!==false,
    createdAt:txt(r,'created_at',new Date().toISOString())
  };
}
export function mapAppointment(r:Db,tenant:string,services:Service[],zone='America/Bogota'):Appointment{
  const service=services.find(s=>s.id===txt(r,'service_id'));
  const start=dayParts(txt(r,'starts_at'),zone),end=dayParts(txt(r,'ends_at'),zone);
  return {
    id:txt(r,'id'),businessId:tenant,barberId:txt(r,'barber_id'),
    customerId:txt(r,'customer_user_id'),customerName:txt(r,'customer_name','Cliente'),
    customerPhone:txt(r,'customer_phone'),serviceId:txt(r,'service_id'),
    serviceName:service?.name||'',date:start.date,startTime:start.time,endTime:end.time,
    durationMinutes:service?.durationMinutes||30,price:money(r,'price_minor'),
    discount:0,finalPrice:money(r,'price_minor'),
    status:txt(r,'status','pending') as Appointment['status'],
    notes:txt(r,'notes'),cancellationReason:txt(r,'cancellation_reason')||undefined,createdAt:txt(r,'created_at',new Date().toISOString())
  };
}
export function mapTransaction(r:Db,tenant:string):Transaction{
  return {id:txt(r,'id'),businessId:tenant,barberId:txt(r,'barber_id')||undefined,
    type:txt(r,'type') as Transaction['type'],category:txt(r,'category','other') as Transaction['category'],
    concept:txt(r,'concept'),amount:money(r,'amount_minor'),
    paymentMethod:txt(r,'payment_method','cash') as Transaction['paymentMethod'],
    date:txt(r,'created_at',new Date().toISOString()),notes:txt(r,'notes'),referenceId:txt(r,'reference_id')||undefined};
}
export function mapOrder(r:Db,tenant:string):Order{
 return {id:txt(r,'id'),businessId:tenant,customerId:txt(r,'customer_user_id'),
   customerName:txt(r,'customer_name'),pickupCode:txt(r,'pickup_code'),
   items:[],total:money(r,'total_minor'),status:txt(r,'status','received') as Order['status'],
   createdAt:txt(r,'created_at',new Date().toISOString())};
}
export function mapPlan(r:Db):SubscriptionPlan{
 return {id:txt(r,'id'),name:txt(r,'name'),
   audience:txt(r,'audience','barbershop')==='independent'?'independent':'barbershop',
   tagline:txt(r,'description'),monthlyPrice:money(r,'monthly_minor'),
   annualPrice:money(r,'annual_minor'),currency:txt(r,'currency','COP'),
   maxBarbers:num(r,'max_barbers'),maxPortfolioImages:num(r,'max_portfolio_images'),
   features:arr(val(r,'features')).map(x=>String(x)),isPopular:false,
   isActive:val(r,'is_active')!==false,order:num(r,'sort_order')};
}
export function tokenUser(id:string,email:string,tenants:Db[],platformRole?:string|null):User{
 const t=tenants[0];
 const role=txt(t||{},'role');
 const userRole:UserRole=platformRole==='superadmin'?'superadmin':
    role==='owner'||role==='manager'?'owner':role==='barber'?'barber_employee':'client';
 return {id,name:email.split('@')[0],email,phone:'',role:userRole,avatar:'',
   businessId:t?.id as string|undefined,createdAt:new Date().toISOString(),
   lastLogin:new Date().toISOString(),status:'active'};
}
export async function loadAccount():Promise<{
  user:User;shops:Barbershop[];barbers:Barber[];services:Service[];
  products:Product[];appointments:Appointment[];transactions:Transaction[];
  orders:Order[];plans:SubscriptionPlan[];cashClosings:CashClosing[];
  reviews:Review[];loyalty:Record<string,LoyaltyAccount>;
  loyaltyBalances:Record<string,LoyaltyBalance>;
  rewards:LoyaltyReward[];redemptions:LoyaltyRedemption[]
}>{
 const [me,tenants]=await Promise.all([
   backendRequest<{id:string;email:string;platformRole:string|null}>('/me'),
   backendRequest<Db[]>('/tenants')
 ]);
 const user=tokenUser(me.id,me.email,tenants,me.platformRole);
 // Supabase Auth is the authoritative source of user-editable identity fields.
 // Failed profile lookups do not block other account data.
 const identity=await getClientAuthProfile().catch(()=>null);
 if(identity){
   user.name=identity.name||user.name;
   user.phone=identity.phone;
   user.avatar=identity.avatar;
   user.email=identity.email||user.email;
 }
 let shopRows=tenants.map(t=>mapShop(t,me.id));
 const tenant=tenants[0]?.id as string|undefined;
 let barbers:Barber[]=[],services:Service[]=[],products:Product[]=[],appointments:Appointment[]=[],transactions:Transaction[]=[],orders:Order[]=[],cashClosings:CashClosing[]=[];
 let reviews:Review[]=[],rewards:LoyaltyReward[]=[],redemptions:LoyaltyRedemption[]=[];
 let loyalty:Record<string,LoyaltyAccount>={},loyaltyBalances:Record<string,LoyaltyBalance>={};
 if(tenant && user.role!=='superadmin'){
   const prefix='/tenants/'+encodeURIComponent(tenant);
   const [bs,ss,ps]=await Promise.all([
     backendRequest<Db[]>(prefix+'/barbers'),
     backendRequest<Db[]>(prefix+'/services'),
     backendRequest<Db[]>(prefix+'/products')
   ]);
   barbers=bs.map(b=>mapBarber(b,tenant));
   if(user.role==='barber_employee'){
     const myBarber=bs.find(b=>txt(b,'user_id')===me.id);
     user.barberId=txt(myBarber||{},'id')||undefined;
     // Same professional photo also appears in the global account header.
     if(myBarber&&txt(myBarber,'photo_url'))user.avatar=txt(myBarber,'photo_url');
   }
   services=ss.map(s=>mapService(s,tenant));
   products=ps.map(x=>mapProduct(x,tenant));
   const from=new Date(Date.now()-7*86400000).toISOString();
   const to=new Date(Date.now()+23*86400000).toISOString();
   const raw=await backendRequest<Db[]>(prefix+'/appointments?start='+encodeURIComponent(from)+'&end='+encodeURIComponent(to));
   appointments=raw.map(a=>mapAppointment(a,tenant,services,txt(tenants[0],'time_zone','America/Bogota')));
   if(userRolePrivileged(user.role)){
     const [tx,ord,closes,rawReviews,rawRewards,rawRedemptions]=await Promise.all([
       backendRequest<Db[]>(prefix+'/transactions'),
       backendRequest<Db[]>(prefix+'/orders'),
       backendRequest<Db[]>(prefix+'/cash-closings'),
       backendRequest<Db[]>(prefix+'/reviews'),
       backendRequest<Db[]>(prefix+'/rewards'),
       backendRequest<Db[]>(prefix+'/redemptions')
     ]);
     reviews=rawReviews.map(r=>mapReview(r));
     rewards=rawRewards.map(mapReward);
     redemptions=rawRedemptions.map(mapRedemption);
     const shop=shopRows.find(s=>s.id===tenant);
     if(shop && reviews.length){
       shop.rating=Number((reviews.reduce((n,r)=>n+r.rating,0)/reviews.length).toFixed(2));
       shop.reviewsCount=reviews.length;
     }
     transactions=tx.map(x=>mapTransaction(x,tenant));orders=ord.map(x=>mapOrder(x,tenant));
     cashClosings=closes.map(x=>mapCashClose(x,tenant));
   }
 }else if(user.role==='superadmin'){
   // A platform admin can inspect the directory through a dedicated authenticated API.
   const global=await backendRequest<Db[]>('/platform/tenants');
   shopRows=global.map(t=>mapShop(t,''));
 }else{
   // Customers have no tenant membership: use public active shops and catalog.
   const publicTenants=await backendRequest<Db[]>('/public/tenants');
   shopRows=publicTenants.map(t=>mapShop(t,''));
   const catalogs=await Promise.all(publicTenants.slice(0,30).map(async t=>{
     const id=txt(t,'id'),slug=encodeURIComponent(txt(t,'slug'));
     const [catalog,p]=await Promise.all([
       backendRequest<{barbers:Db[];services:Db[]}>('/public/tenants/'+slug+'/catalog'),
       backendRequest<Db[]>('/public/tenants/'+id+'/products')
     ]);
     return {id,barbers:catalog.barbers.map(b=>({...mapBarber(b,id),isIndependent:false})),
       services:catalog.services.map(s=>mapService(s,id)),
       products:p.map(x=>mapProduct(x,id))};
   }));
   barbers=catalogs.flatMap(x=>x.barbers);
   services=catalogs.flatMap(x=>x.services);
   products=catalogs.flatMap(x=>x.products);
   const [mine,ownedReviews,balances,events,customerRewards,customerRedemptions]=await Promise.all([
     backendRequest<Db[]>('/me/bookings'),
     backendRequest<Db[]>('/me/reviews'),
     backendRequest<Db[]>('/me/loyalty'),
     backendRequest<Db[]>('/me/loyalty-events'),
     backendRequest<Db[]>('/me/rewards'),
     backendRequest<Db[]>('/me/redemptions')
   ]);
   appointments=mine.map(a=>mapAppointment(a,txt(a,'tenant_id'),services));
   reviews=ownedReviews.map(r=>mapReview(r,me.id));
   rewards=customerRewards.map(mapReward);
   redemptions=customerRedemptions.map(mapRedemption);
   for(const row of balances){
     const tenantId=txt(row,'tenant_id');
     loyaltyBalances[tenantId]={tenantId,points:num(row,'points'),visitsCount:num(row,'visits_count')};
   }
   loyalty[me.id]={customerId:me.id,points:Object.values(loyaltyBalances).reduce((total,b)=>total+b.points,0),
     visitsCount:Object.values(loyaltyBalances).reduce((total,b)=>total+b.visitsCount,0),
     currentStreak:0,achievements:[],
     pointHistory:events.map(e=>({id:txt(e,'id'),date:txt(e,'created_at').slice(0,10),concept:txt(e,'description'),points:num(e,'points_delta')}))};
   for(const shop of shopRows){shop.rating=0;shop.reviewsCount=0;}
 }
 const plans=await backendRequest<Db[]>('/public/plans').catch(()=>[] as Db[]);
 return {user,shops:shopRows,barbers,services,products,appointments,transactions,orders,plans:plans.map(mapPlan),cashClosings,
   reviews,loyalty,loyaltyBalances,rewards,redemptions};
}
function userRolePrivileged(role:UserRole){return role==='owner'||role==='superadmin';}
export async function addService(tenant:string,data:{name:string;description:string;price:number;durationMinutes:number;category:string;earnsLoyaltyPoints:boolean}){
 const r=await backendRequest<Db>('/tenants/'+tenant+'/services',{method:'POST',body:JSON.stringify({
   name:data.name,description:data.description,priceMinor:Math.round(data.price),
   durationMinutes:data.durationMinutes,category:data.category,earnsLoyaltyPoints:data.earnsLoyaltyPoints
 })});
 return mapService(r,tenant);
}
export async function addProduct(tenant:string,data:{name:string;sku:string;price:number;stock:number;
  description?:string;photo?:string;category?:Product['category'];cost?:number;minStock?:number;isVisibleInWaitingRoom?:boolean}){
 const r=await backendRequest<Db>('/tenants/'+tenant+'/products',{method:'POST',body:JSON.stringify({
   name:data.name,sku:data.sku,priceMinor:Math.round(data.price),stock:data.stock,
   description:data.description||'',photoUrl:data.photo||'',category:data.category||'beauty',
   costMinor:Math.round(data.cost||0),minStock:data.minStock||0,
   waitingRoomVisible:data.isVisibleInWaitingRoom!==false
 })});
 return mapProduct(r,tenant);
}
export async function editProduct(tenant:string,id:string,data:{
 name:string;sku:string;price:number;description:string;photo:string;category:Product['category'];cost:number;minStock:number;
}){
 const row=await backendRequest<Db>('/tenants/'+tenant+'/products/'+id,{method:'PATCH',body:JSON.stringify({
 name:data.name,sku:data.sku,priceMinor:Math.round(data.price),description:data.description,photoUrl:data.photo,
 category:data.category,costMinor:Math.round(data.cost),minStock:data.minStock
 })});
 return mapProduct(row,tenant);
}
export async function removeProduct(tenant:string,id:string){
 await backendRequest('/tenants/'+tenant+'/products/'+id,{method:'DELETE'});
}
export async function restoreProduct(tenant:string,id:string){
 return mapProduct(await backendRequest<Db>('/tenants/'+tenant+'/products/'+id+'/restore',{method:'PATCH'}),tenant);
}
export async function createReward(tenant:string,data:{title:string;description:string;pointsCost:number;isActive:boolean}){
 return mapReward(await backendRequest<Db>('/tenants/'+tenant+'/rewards',
   {method:'POST',body:JSON.stringify(data)}));
}
export async function editReward(tenant:string,id:string,data:Partial<{title:string;description:string;pointsCost:number;isActive:boolean}>){
 return mapReward(await backendRequest<Db>('/tenants/'+tenant+'/rewards/'+id,
   {method:'PATCH',body:JSON.stringify(data)}));
}
export async function fulfillRedemption(tenant:string,id:string){
 return backendRequest('/tenants/'+tenant+'/redemptions/'+id+'/fulfill',{method:'PATCH'});
}
export async function redeemReward(tenant:string,id:string){
 return backendRequest('/tenants/'+tenant+'/redeem',
   {method:'POST',body:JSON.stringify({rewardId:id})},
   'r'+crypto.randomUUID().replace(/-/g,''));
}
export async function publishReview(tenant:string,appointmentId:string,rating:number,comment:string){
 return backendRequest('/tenants/'+tenant+'/reviews',
   {method:'POST',body:JSON.stringify({appointmentId,rating,comment})});
}
export async function adjustStock(tenant:string,productId:string,delta:number,reason:string){
 return mapProduct(await backendRequest<Db>('/tenants/'+tenant+'/products/'+productId+'/stock',
   {method:'POST',body:JSON.stringify({delta,reason})}),tenant);
}
/** Availability from server (working hours, time off, holidays and overlaps).
 * Never synthesize open slots in the browser. */
export async function getAvailabilitySlots(tenant:string,barberId:string,serviceId:string,date:string,zone='America/Bogota'):Promise<string[]>{
 const params=new URLSearchParams({barberId,serviceId,date});
 const response=await fetch(apiOrigin+'/public/tenants/'+encodeURIComponent(tenant)+'/availability?'+params.toString(),{cache:'no-store'});
 const json=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(json.error||'No fue posible consultar la disponibilidad.');
 const list:{starts_at:string}[]=Array.isArray(json.slots)?json.slots:[];
 return [...new Set<string>(list.map(s=>dayParts(s.starts_at,zone).time))].sort();
}
export async function addBooking(tenant:string,data:{barberId:string;serviceId:string;date:string;startTime:string;customerName:string;customerPhone:string;notes?:string},zone='America/Bogota'){
 // Obtain a server-computed instant instead of constructing a misleading UTC timestamp in the browser.
 const slots=await fetch(apiOrigin+'/public/tenants/'+encodeURIComponent(tenant)+
   '/availability?barberId='+encodeURIComponent(data.barberId)+
   '&serviceId='+encodeURIComponent(data.serviceId)+'&date='+encodeURIComponent(data.date))
   .then(async res=>{const body=await res.json();if(!res.ok)throw Error(body.error||'No se pudo consultar disponibilidad');return body as {slots:{starts_at:string}[]};});
 const selected=slots.slots.find(s=>dayParts(s.starts_at,zone).time===data.startTime);
 if(!selected)throw Error('El horario seleccionado ya no está disponible. Actualiza la agenda.');
 const idempotencyKey='b'+crypto.randomUUID().replace(/-/g,'');
 return backendRequest<Db>('/tenants/'+tenant+'/bookings',{method:'POST',
   body:JSON.stringify({barberId:data.barberId,serviceId:data.serviceId,
     startsAt:selected.starts_at,customerName:data.customerName,customerPhone:data.customerPhone,
     notes:data.notes||''})},idempotencyKey);
}
export type AppointmentPaymentReceipt={
 appointmentId:string;customerName:string;serviceName:string;startsAt:string;
 completed:boolean;totalMinor:number;currency:string;paymentMethod:string;
 transactionId:string|null;receivedAt:string;recordedBy:string|null;
 reference:string;verification:string
};
export async function finishAndPayAppointment(tenant:string,id:string,
 method:'cash'|'nequi'|'daviplata'|'transfer'|'debit'|'credit',reference=''):Promise<AppointmentPaymentReceipt>{
 return backendRequest<AppointmentPaymentReceipt>(
  '/tenants/'+encodeURIComponent(tenant)+'/appointments/'+encodeURIComponent(id)+'/finish-and-pay',
  {method:'POST',body:JSON.stringify({method,reference,confirmReceived:true})});
}
export async function fetchAppointmentReceipt(tenant:string,id:string):Promise<AppointmentPaymentReceipt>{
 return backendRequest<AppointmentPaymentReceipt>(
  '/tenants/'+encodeURIComponent(tenant)+'/appointments/'+encodeURIComponent(id)+'/payment-receipt');
}
export async function updateBooking(tenant:string,id:string,status:string,reason?:string){
 return backendRequest<Db>('/tenants/'+tenant+'/appointments/'+id+'/status',
  {method:'PATCH',body:JSON.stringify({status,...(reason?{reason}:{})})});
}
export async function addOrder(tenant:string,name:string,items:{productId:string;quantity:number}[]){
 const key='o'+crypto.randomUUID().replace(/-/g,'');
 return backendRequest<Db>('/tenants/'+tenant+'/orders',
   {method:'POST',body:JSON.stringify({customerName:name,items})},key);
}
export function toSlug(name:string){return slugFor(name);}

import {barberStore} from './store';

export async function refreshLiveData(){
  if(!isLiveBackend)return;
  const result=await loadAccount();
  barberStore.hydrateFromBackend({
    users:[result.user],barbershops:result.shops,barbers:result.barbers,
    services:result.services,products:result.products,appointments:result.appointments,
    transactions:result.transactions,orders:result.orders,plans:result.plans,cashClosings:result.cashClosings,reviews:result.reviews,loyalty:result.loyalty,
    loyaltyBalances:result.loyaltyBalances,rewards:result.rewards,redemptions:result.redemptions
  });
}
export async function editService(tenant:string,id:string,data:{
  name:string;description:string;price:number;durationMinutes:number;category:string;earnsLoyaltyPoints:boolean
}){
  const r=await backendRequest<Db>('/tenants/'+tenant+'/services/'+id,{
    method:'PATCH',
    body:JSON.stringify({name:data.name,description:data.description,
      priceMinor:Math.round(data.price),durationMinutes:data.durationMinutes,category:data.category,earnsLoyaltyPoints:data.earnsLoyaltyPoints})
  });
  return mapService(r,tenant);
}
export async function recordTransaction(tenant:string,data:{
 type:'income'|'expense';category:string;concept:string;amount:number;paymentMethod:string;notes?:string
}){
 const r=await backendRequest<Db>('/tenants/'+tenant+'/transactions',{method:'POST',
   body:JSON.stringify({type:data.type,category:data.category,concept:data.concept,
     amountMinor:Math.round(data.amount),paymentMethod:data.paymentMethod,notes:data.notes||''})});
 return mapTransaction(r,tenant);
}

export async function registerOwnedShop(name:string){
  const clean=name.trim();
  if(clean.length<2||clean.length>120)throw Error('El nombre de la barbería debe tener entre 2 y 120 caracteres.');
  const slug=toSlug(clean)+'-'+crypto.randomUUID().slice(0,8);
  return backendRequest<Db>('/tenants',{method:'POST',body:JSON.stringify({
    name:clean,slug,currency:'COP',timeZone:'America/Bogota'
  })});
}

export function mapCashClose(r:Db,tenant:string):CashClosing{
 const open=num(r,'opening_cash_minor'),income=num(r,'cash_income_minor'),
   out=num(r,'cash_expenses_minor'),withdrawals=num(r,'withdrawals_minor');
 const theoretical=open+income-out-withdrawals;
 return {id:txt(r,'id'),businessId:tenant,date:txt(r,'closing_date'),
   openedAt:'',closedAt:txt(r,'created_at'),responsibleName:'Responsable autorizado',
   openingCash:open,cashIncome:income,electronicIncome:num(r,'electronic_income_minor'),
   expensesPaidFromCash:out,withdrawals,theoreticalCash:theoretical,
   actualCashCounted:num(r,'actual_cash_minor'),difference:num(r,'actual_cash_minor')-theoretical,
   notes:txt(r,'notes'),status:'closed'};
}
export async function closeCash(tenant:string,closing:CashClosing){
 return backendRequest<Db>('/tenants/'+tenant+'/cash-closings',{method:'POST',body:JSON.stringify({
   closingDate:closing.date,openingCashMinor:Math.round(closing.openingCash),
   withdrawalsMinor:Math.round(closing.withdrawals),
   actualCashMinor:Math.round(closing.actualCashCounted),notes:closing.notes
 })});
}

export async function setProductVisibility(tenant:string,productId:string,visible:boolean){
 return mapProduct(await backendRequest<Db>('/tenants/'+tenant+'/products/'+productId+'/visibility',
  {method:'PATCH',body:JSON.stringify({visible})}),tenant);
}

export type TenantCustomer={
 id:string;name:string;email:string;phone:string;avatar:string;
 linkedByQr:boolean;linkedAt:string|null;visits:number;totalSpent:number;
 lastService:string|null;lastServiceAt:string|null;points:number
};
export const listTenantCustomers=(tenantId:string)=>
 backendRequest<TenantCustomer[]>('/tenants/'+encodeURIComponent(tenantId)+'/customers');

export type CustomerLink={
 tenant_id:string;slug:string;name:string;business_kind:'barbershop'|'independent';
 barber_id:string|null;barber_name:string|null;barber_slug:string|null;linked_at:string
};
export type PublicBusinessLink={
 tenant_id:string;slug:string;name:string;business_kind:'barbershop'|'independent';
 link_code:string;barber_id:string|null;barber_name:string|null
};
export const getBusinessLinkCode=(tenant:string)=>
 backendRequest<{tenant_id:string;link_code:string;name:string}>('/tenants/'+encodeURIComponent(tenant)+'/link-code');
export async function resolveBusinessLink(code:string):Promise<PublicBusinessLink>{
 const response=await fetch(apiOrigin+'/public/links/'+encodeURIComponent(code.trim()),{cache:'no-store'});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw Error(data?.error||'El QR no corresponde a un negocio activo');
 return data as PublicBusinessLink;
}
export const listCustomerLinks=()=>backendRequest<{items:CustomerLink[];profile:{full_name:string;phone:string}|null}>('/me/links');
export async function linkCustomer(code:string,fullName:string,phone:string){
 const result=await backendRequest<{tenantId:string;name:string;kind:string}>('/me/links',{method:'POST',
 body:JSON.stringify({code,fullName,phone})});
 window.dispatchEvent(new Event('barberos-links-updated'));
 return result;
}
