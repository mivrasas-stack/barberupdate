import type {
  Appointment, Barber, Barbershop, Product, Service, SubscriptionPlan, Transaction, Order, User, UserRole, CashClosing
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
export function hasSession(){return !!session||!!sessionStorage.getItem(storageKey);}
async function authCall(path:string,payload:object){
  if(!supabaseUrl||!supabasePublicKey)throw Error('Faltan variables públicas de Supabase para conectar BarberOS.');
  const result=await fetch(supabaseUrl+'/auth/v1/'+path,{
    method:'POST',headers:{apikey:supabasePublicKey,'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  });
  const data=await result.json().catch(()=>({}));
  if(!result.ok)throw Error(data.msg||data.error_description||data.message||'No se pudo iniciar sesión.');
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
export async function registerWithEmail(email:string,password:string){
  const data = await authCall('signup',{email,password});
  if(data?.access_token && data?.refresh_token){
    receiveToken(data);
  }
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
function safeRandomUUID():string{
  if(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'){
    return crypto.randomUUID();
  }
  if(typeof crypto!=='undefined'&&typeof crypto.getRandomValues==='function'){
    const bytes=new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6]=(bytes[6]&0x0f)|0x40;
    bytes[8]=(bytes[8]&0x3f)|0x80;
    const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
    const r=(Math.random()*16)|0;
    const v=c==='x'?r:(r&0x3)|0x8;
    return v.toString(16);
  });
}
function dayParts(raw:string,zone='America/Bogota'){
  const d=new Date(raw);
  const pieces=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(d);
  const pick=(k:string)=>pieces.find(p=>p.type===k)?.value||'00';
  return {date:pick('year')+'-'+pick('month')+'-'+pick('day'),time:pick('hour')+':'+pick('minute')};
}
export function mapShop(r:Db,userId:string):Barbershop{
  const portfolioRaw=val(r,'portfolio');
  const portfolio=Array.isArray(portfolioRaw)?portfolioRaw.map(x=>String(x)):[];
  return {
    id:txt(r,'id'),slug:txt(r,'slug'),name:txt(r,'name'),ownerId:userId,
    tagline:txt(r,'tagline',''),logo:txt(r,'logo_url',''),coverImage:txt(r,'cover_url',''),phone:'',email:'',address:'',city:'',
    planId:'',subscriptionStatus:'trial',subscriptionRenewsAt:'',rating:0,reviewsCount:0,
    openingHours:{days:'',open:'',close:''},socialLinks:{},portfolio,
    publicCode:txt(r,'slug'),businessKind:txt(r,'business_kind','barbershop') as Barbershop['businessKind'],createdAt:txt(r,'created_at',new Date().toISOString())
  };
}
export function mapBarber(r:Db,tenant:string):Barber{
  const portfolioRaw=val(r,'portfolio');
  const portfolio=Array.isArray(portfolioRaw)?portfolioRaw.map(x=>String(x)):[];
  return {
    id:txt(r,'id'),businessId:tenant,slug:txt(r,'slug'),
    name:txt(r,'name'),photo:txt(r,'photo_url',''),phone:'',email:'',specialties:[],
    bio:txt(r,'bio'),commissionRate:num(r,'commission_rate'),
    status:txt(r,'status','active')==='active'?'active':'inactive',
    rating:0,reviewsCount:0,portfolio,workDays:[],workHours:{start:'09:00',end:'18:00'},
    isIndependent:false,publicCode:txt(r,'slug')
  };
}
export function mapService(r:Db,tenant:string):Service{
  const category=txt(r,'category','haircut') as Service['category'];
  return {
    id:txt(r,'id'),businessId:tenant,name:txt(r,'name'),description:txt(r,'description'),
    price:money(r,'price_minor'),durationMinutes:num(r,'duration_minutes',30),
    category:['haircut','beard','combo','eyebrows','treatments','special'].includes(category)?category:'special',
    barberIds:[],isActive:val(r,'is_active')!==false,order:0
  };
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
    notes:txt(r,'notes'),createdAt:txt(r,'created_at',new Date().toISOString())
  };
}
export function mapTransaction(r:Db,tenant:string):Transaction{
  return {id:txt(r,'id'),businessId:tenant,barberId:txt(r,'barber_id')||undefined,
    type:txt(r,'type') as Transaction['type'],category:txt(r,'category','other') as Transaction['category'],
    concept:txt(r,'concept'),amount:money(r,'amount_minor'),
    paymentMethod:txt(r,'payment_method','cash') as Transaction['paymentMethod'],
    date:txt(r,'created_at',new Date().toISOString()),referenceId:txt(r,'reference_id')||undefined};
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
    role==='owner'&&txt(t||{},'business_kind')==='independent'?'barber_independent':
    role==='owner'||role==='manager'?'owner':role==='barber'?'barber_employee':'client';
 return {id,name:email.split('@')[0],email,phone:'',role:userRole,avatar:'',
   businessId:t?.id as string|undefined,createdAt:new Date().toISOString(),
   lastLogin:new Date().toISOString(),status:'active'};
}
export async function loadAccount():Promise<{
  user:User;shops:Barbershop[];barbers:Barber[];services:Service[];
  products:Product[];appointments:Appointment[];transactions:Transaction[];
  orders:Order[];plans:SubscriptionPlan[];cashClosings:CashClosing[]
}>{
 const [me,tenants]=await Promise.all([
   backendRequest<{id:string;email:string;platformRole:string|null}>('/me'),
   backendRequest<Db[]>('/tenants')
 ]);
 const user=tokenUser(me.id,me.email,tenants,me.platformRole);
 let shopRows=tenants.map(t=>mapShop(t,me.id));
 const tenant=tenants[0]?.id as string|undefined;
 let barbers:Barber[]=[],services:Service[]=[],products:Product[]=[],appointments:Appointment[]=[],transactions:Transaction[]=[],orders:Order[]=[],cashClosings:CashClosing[]=[];
 if(tenant){
   const prefix='/tenants/'+encodeURIComponent(tenant);
   const [bs,ss,ps]=await Promise.all([
     backendRequest<Db[]>(prefix+'/barbers'),
     backendRequest<Db[]>(prefix+'/services'),
     backendRequest<Db[]>(prefix+'/products')
   ]);
   barbers=bs.map(b=>({...mapBarber(b,tenant),isIndependent:user.role==='barber_independent'}));
   if(user.role==='barber_independent')user.barberId=txt(bs.find(b=>txt(b,'user_id')===me.id)||{},'id')||undefined;
   if(user.role==='barber_employee')user.barberId=txt(bs.find(b=>txt(b,'user_id')===me.id)||{},'id')||undefined;
   services=ss.map(s=>mapService(s,tenant));
   products=ps.map(x=>mapProduct(x,tenant));
   const from=new Date(Date.now()-7*86400000).toISOString();
   const to=new Date(Date.now()+23*86400000).toISOString();
   const raw=await backendRequest<Db[]>(prefix+'/appointments?start='+encodeURIComponent(from)+'&end='+encodeURIComponent(to));
   appointments=raw.map(a=>mapAppointment(a,tenant,services,txt(tenants[0],'time_zone','America/Bogota')));
   if(userRolePrivileged(user.role)){
     const [tx,ord,closes]=await Promise.all([
       backendRequest<Db[]>(prefix+'/transactions'),
       backendRequest<Db[]>(prefix+'/orders'),
       backendRequest<Db[]>(prefix+'/cash-closings')
     ]);
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
     return {id,barbers:catalog.barbers.map(b=>({...mapBarber(b,id),isIndependent:txt(t,'business_kind')==='independent'})),
       services:catalog.services.map(s=>mapService(s,id)),
       products:p.map(x=>mapProduct(x,id))};
   }));
   barbers=catalogs.flatMap(x=>x.barbers);
   services=catalogs.flatMap(x=>x.services);
   products=catalogs.flatMap(x=>x.products);
   const mine=await backendRequest<Db[]>('/me/bookings');
   appointments=mine.map(a=>mapAppointment(a,txt(a,'tenant_id'),services));
 }
 const plans=await backendRequest<Db[]>('/public/plans').catch(()=>[] as Db[]);
 return {user,shops:shopRows,barbers,services,products,appointments,transactions,orders,plans:plans.map(mapPlan),cashClosings};
}
function userRolePrivileged(role:UserRole){return role==='owner'||role==='superadmin'||role==='barber_independent';}
export async function addService(tenant:string,data:{name:string;description:string;price:number;durationMinutes:number;category:string}){
 const r=await backendRequest<Db>('/tenants/'+tenant+'/services',{method:'POST',body:JSON.stringify({
   name:data.name,description:data.description,priceMinor:Math.round(data.price),
   durationMinutes:data.durationMinutes,category:data.category
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
export async function adjustStock(tenant:string,productId:string,delta:number,reason:string){
 return mapProduct(await backendRequest<Db>('/tenants/'+tenant+'/products/'+productId+'/stock',
   {method:'POST',body:JSON.stringify({delta,reason})}),tenant);
}
export async function updateProductDetails(tenant:string,productId:string,data:{
  name?:string;sku?:string;price?:number;description?:string;photo?:string;
  category?:Product['category'];cost?:number;minStock?:number;isVisibleInWaitingRoom?:boolean;
}){
  const payload:Db={};
  if(data.name!==undefined)payload.name=data.name;
  if(data.sku!==undefined)payload.sku=data.sku;
  if(data.price!==undefined)payload.priceMinor=Math.round(data.price);
  if(data.description!==undefined)payload.description=data.description;
  if(data.photo!==undefined)payload.photoUrl=data.photo;
  if(data.category!==undefined)payload.category=data.category;
  if(data.cost!==undefined)payload.costMinor=Math.round(data.cost);
  if(data.minStock!==undefined)payload.minStock=data.minStock;
  if(data.isVisibleInWaitingRoom!==undefined)payload.waitingRoomVisible=data.isVisibleInWaitingRoom;
  const r=await backendRequest<Db>('/tenants/'+tenant+'/products/'+productId,{
    method:'PATCH',body:JSON.stringify(payload)
  });
  return mapProduct(r,tenant);
}
export async function updateShopProfile(tenant:string,data:{
  name?:string;tagline?:string;logoUrl?:string;coverUrl?:string;portfolio?:string[];
}){
  const r=await backendRequest<Db>('/tenants/'+tenant+'/profile',{
    method:'PATCH',body:JSON.stringify(data)
  });
  return mapShop(r,'');
}
export async function updateBarberProfile(tenant:string,barberId:string,data:{
  name?:string;bio?:string;photoUrl?:string;portfolio?:string[];
}){
  const r=await backendRequest<Db>('/tenants/'+tenant+'/barbers/'+barberId,{
    method:'PATCH',body:JSON.stringify(data)
  });
  return mapBarber(r,tenant);
}
export async function updateCustomerProfile(data:{
  fullName?:string;phone?:string;avatarUrl?:string;
}){
  return backendRequest<{user_id:string;full_name:string;phone:string;avatar_url:string}>('/me/profile',{
    method:'PATCH',body:JSON.stringify(data)
  });
}
export async function getAvailabilitySlots(
  tenant: string,
  barberId: string,
  serviceId: string,
  date: string,
  zone = 'America/Bogota'
): Promise<string[]> {
  if (!isLiveBackend || !tenant || !barberId || !serviceId || !date) return [];
  try {
    const res = await fetch(
      apiOrigin +
        '/public/tenants/' +
        encodeURIComponent(tenant) +
        '/availability?barberId=' +
        encodeURIComponent(barberId) +
        '&serviceId=' +
        encodeURIComponent(serviceId) +
        '&date=' +
        encodeURIComponent(date)
    );
    if (!res.ok) return [];
    const body = (await res.json()) as { slots?: { starts_at: string }[] };
    if (!Array.isArray(body?.slots)) return [];
    return body.slots.map((s) => dayParts(s.starts_at, zone).time);
  } catch {
    return [];
  }
}

export async function addBooking(tenant:string,data:{barberId:string;serviceId:string;date:string;startTime:string;customerName:string;customerPhone:string;whatsappOptIn?:boolean;notes?:string},zone='America/Bogota'){
 // Obtain a server-computed instant instead of constructing a misleading UTC timestamp in the browser.
 const slots=await fetch(apiOrigin+'/public/tenants/'+encodeURIComponent(tenant)+
   '/availability?barberId='+encodeURIComponent(data.barberId)+
   '&serviceId='+encodeURIComponent(data.serviceId)+'&date='+encodeURIComponent(data.date))
   .then(async res=>{const body=await res.json();if(!res.ok)throw Error(body.error||'No se pudo consultar disponibilidad');return body as {slots:{starts_at:string}[]};});
 const selected=slots.slots.find(s=>dayParts(s.starts_at,zone).time===data.startTime);
 if(!selected)throw Error('El horario seleccionado ya no está disponible. Actualiza la agenda.');
 const idempotencyKey='b'+safeRandomUUID().replace(/-/g,'');
 return backendRequest<Db>('/tenants/'+tenant+'/bookings',{method:'POST',
   body:JSON.stringify({barberId:data.barberId,serviceId:data.serviceId,
     startsAt:selected.starts_at,customerName:data.customerName,customerPhone:data.customerPhone,
     whatsappOptIn:Boolean(data.whatsappOptIn),
     notes:data.notes||''})},idempotencyKey);
}
export async function updateBooking(tenant:string,id:string,status:string){
 return backendRequest<Db>('/tenants/'+tenant+'/appointments/'+id+'/status',
  {method:'PATCH',body:JSON.stringify({status})});
}
export async function addOrder(tenant:string,name:string,items:{productId:string;quantity:number}[]){
 const key='o'+safeRandomUUID().replace(/-/g,'');
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
    transactions:result.transactions,orders:result.orders,plans:result.plans,cashClosings:result.cashClosings
  });
}
export async function editService(tenant:string,id:string,data:{
  name:string;description:string;price:number;durationMinutes:number;category:string
}){
  const r=await backendRequest<Db>('/tenants/'+tenant+'/services/'+id,{
    method:'PATCH',
    body:JSON.stringify({name:data.name,description:data.description,
      priceMinor:Math.round(data.price),durationMinutes:data.durationMinutes,category:data.category})
  });
  return mapService(r,tenant);
}
export async function recordTransaction(tenant:string,data:{
 type:'income'|'expense';category:string;concept:string;amount:number;paymentMethod:string
}){
 const r=await backendRequest<Db>('/tenants/'+tenant+'/transactions',{method:'POST',
   body:JSON.stringify({type:data.type,category:data.category,concept:data.concept,
     amountMinor:Math.round(data.amount),paymentMethod:data.paymentMethod})});
 return mapTransaction(r,tenant);
}

export async function registerOwnedShop(name:string){
  const clean=name.trim();
  if(clean.length<2||clean.length>120)throw Error('El nombre de la barbería debe tener entre 2 y 120 caracteres.');
  const slug=toSlug(clean)+'-'+safeRandomUUID().slice(0,8);
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

export type CustomerLink={
 tenant_id:string;slug:string;name:string;business_kind:'barbershop'|'independent';
 barber_id:string|null;barber_name:string|null;barber_slug:string|null;link_scope?:'both'|'barber'|'shop';linked_at:string
};
export type PublicBusinessLink={
 tenant_id:string;slug:string;name:string;business_kind:'barbershop'|'independent';
 link_code:string;barber_id:string|null;barber_name:string|null;barber_slug?:string|null;
 link_type?:'barber'|'shop'
};
export const getBusinessLinkCode=(tenant:string,barberId?:string)=>
 backendRequest<{
   tenant_id:string;link_code:string;name:string;slug:string;business_kind:'barbershop'|'independent';
   barber_id?:string;barber_name?:string;barber_slug?:string;barber_link_code?:string;
   shop_link_code?:string;link_type?:string
 }>('/tenants/'+encodeURIComponent(tenant)+'/link-code'+(barberId?'?barberId='+encodeURIComponent(barberId):''));
export async function resolveBusinessLink(code:string):Promise<PublicBusinessLink>{
 const response=await fetch(apiOrigin+'/public/links/'+encodeURIComponent(code.trim()),{cache:'no-store'});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw Error(data?.error||'El QR no corresponde a un negocio activo');
 return data as PublicBusinessLink;
}
export const listCustomerLinks=()=>backendRequest<{items:CustomerLink[];profile:{full_name:string;phone:string}|null}>('/me/links');
export async function linkCustomer(code:string,fullName:string,phone:string,linkScope?:'both'|'barber'|'shop'){
 const result=await backendRequest<{tenantId:string;name:string;kind:string;barberId?:string|null;barberName?:string|null;linkScope?:string}>('/me/links',{method:'POST',
 body:JSON.stringify({code,fullName,phone,linkScope})});
 window.dispatchEvent(new Event('barberos-links-updated'));
 return result;
}

export type TenantCustomer = {
  id: string;
  name: string;
  phone: string;
  linked_at: string | null;
  is_linked: boolean;
  preferred_barber_name: string | null;
  total_appointments: number;
  completed_appointments: number;
  total_spent_minor: number;
  last_visit_at: string | null;
};
export const listTenantCustomers = (tenant: string) =>
  backendRequest<{ items: TenantCustomer[] }>('/tenants/' + encodeURIComponent(tenant) + '/customers');
