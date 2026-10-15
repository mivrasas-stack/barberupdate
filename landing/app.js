import './styles.css';

const app=document.getElementById('app');
const SYSTEM_LOGIN=window.location.port==='9102'?'http://localhost:3000/login':'/login';
const route=location.pathname.replace(/\/+$/,'')||'/';
const btn=(text,url,style='')=>`<a class="button ${style}" href="${url}">${text}</a>`;
const logo=(extra='')=>`<img class="brand-logo ${extra}" src="/branding/barbernow-logo.png" alt="BarberNow" draggable="false">`;
const brandLink=()=>`<a class="brand brand--image" href="/" aria-label="BarberNow - inicio">${logo()}</a>`;
const nav=()=>`<header class="nav" id="main-nav"><div class="nav-inner">
${brandLink()}
<nav class="nav-links" aria-label="Principal"><a href="/#home">INICIO</a><a href="/#about">NUESTRA VISIÓN</a><a href="/directorio">DIRECTORIO</a><a href="/profesionales">PROFESIONALES</a></nav>
<div class="nav-actions"><button id="theme" class="theme-btn" aria-label="Cambiar tema">☾</button><a class="minor-link" href="/profesionales">SOY BARBERO</a>${btn('RESERVAR','/login','compact')}</div>
<button id="menu-btn" class="mobile-toggle" aria-label="Abrir menú" aria-expanded="false">☰</button></div>
<nav id="mobile-menu" class="mobile-menu"><a href="/#home">Inicio</a><a href="/#about">Nuestra visión</a><a href="/directorio">Directorio</a><a href="/profesionales">Profesionales</a><a href="/profesionales">Soy Barbero</a><a href="/login">Reservar</a><button id="theme-mobile" class="theme-btn">☾ Cambiar tema</button></nav></header>`;
const footer=()=>`<footer class="footer"><div class="footer-grid">
<div><a href="/" class="footer-logo" aria-label="BarberNow - inicio">${logo()}</a><p>El arte de la barbería clásica elevada a una experiencia de lujo contemporánea. Redefiniendo el cuidado masculino desde 2007.</p><div class="socials"><a href="#" aria-label="Instagram">◎</a><a href="#" aria-label="Facebook">f</a><a href="#" aria-label="Twitter">♡</a></div></div>
<div><h3>EXPLORAR</h3><nav class="footer-links"><a href="/#about">Manifiesto</a><a href="/#services">Servicios</a><a href="/#portfolio">Galería</a><a href="/#products">Boutique</a></nav></div>
<div class="footer-contact"><h3>CONTACTO</h3><p><span class="gold">♧</span>123 Luxury Ave, NY 10001</p><p><span class="gold">♧</span>+1 (555) 123-4567</p><p><span class="gold">✉</span>Contacto a través de BarberNow</p></div>
</div><div class="footer-bottom"><span>© 2026 BarberNow. Todos los derechos reservados.</span><span><a href="#">Privacidad</a><a href="#">Términos</a></span></div></footer>`;
function home(){return nav()+`<section class="hero" id="home"><div class="hero-bg" role="img" aria-label="Corte premium en barbería"></div>
<div class="hero-content"><span class="eyebrow">ESTILO &amp; PERFECCIÓN</span><h1><span>NO HACEMOS CORTES</span><span class="fade">CREAMOS IDENTIDAD</span></h1>
<p class="description">Experimenta el arte del grooming tradicional combinado con la sofisticación moderna en un ambiente de absoluta exclusividad.</p>
<div class="hero-buttons">${btn('RESERVAR CITA','/login')}${btn('VER SERVICIOS','#services','secondary')}</div>
<div class="small-promote">¿Eres barbero profesional independiente?　<a href="/profesionales"><strong>Crea tu propio espacio →</strong></a></div></div>
<a href="#about" class="discover">DESCUBRIR<span>⌄</span></a></section>
<section class="about" id="about"><div class="about-inner"><div>
<span class="eyebrow">EL MANIFIESTO</span><h2>SERVICIO MÁS ALLÁ <span class="muted">DE LAS EXPECTATIVAS</span></h2>
<p>En BarberNow, creemos que un corte de pelo es más que una simple tarea rutinaria: es un oficio, una forma de arte y una declaración de estilo personal.</p>
<p>Fundada en 2007, nos hemos dedicado a brindar una experiencia de aseo premium para el hombre moderno. Nuestros barberos son maestros, combinando técnicas tradicionales con un estilo contemporáneo.</p>
<div class="stats"><div class="stat"><strong>+10</strong><span>AÑOS</span></div><div class="stat"><strong>+5K</strong><span>CLIENTES</span></div><div class="stat"><strong class="gold">4.9★</strong><span>RATING</span></div></div>
<a href="#portfolio" class="button outline small">VER GALERÍA</a></div>
<div id="portfolio"><img class="about-picture" alt="Premium Barber Experience" src="/assets/manifesto.webp"></div></div><span id="services"></span></section>
<section class="cta" id="products"><div><span class="cta-tag">● &nbsp; AGENDA ABIERTA</span><h2>¿LISTO PARA TU <em>NUEVO ESTILO?</em></h2>
<p>La excelencia no es un acto, es un hábito. Únete al selecto grupo de clientes que han descubierto su mejor versión.</p>
${btn('RESERVAR CITA AHORA　 →','/login')}<div class="note">Cupos limitados disponibles para esta semana</div></div></section>`+footer()}
function directory(){return `<main class="directory"><div class="directory-wrap"><a class="back-link" href="/">← Volver al inicio</a>
<article class="directory-card"><div class="directory-icon">♧</div><p class="eyebrow">BARBERNOW · DIRECTORIO</p>
<h1>BARBERÍAS<br>VERIFICADAS</h1><p class="copy">El directorio público se está conectando con los negocios que autoricen expresamente su publicación. No mostramos establecimientos, reseñas, rankings ni reservas ficticias.</p>
<div class="directory-alert"><span class="gold">⬡</span>Todavía no hay establecimientos publicados y verificados para este listado.</div>
<a class="back-link small" href="/login">Acceder a mi cuenta　 →</a></article></div></main>`}
const benefits=[
['♙','Tus Clientes te Pertenecen','Tus clientes, fichas técnicas y preferencias son de tu propiedad. Si cambias de sede o abres tu propio estudio, mantienes el 100% de tu cartera de clientes.'],
['▦','Afiliaciones Multisede Flexibles','Atiende físicamente en una o varias barberías bajo modelos de alquiler de silla o comisión. Todo centralizado bajo tu único perfil profesional.'],
['♢','Concurrencia Atómica Anti Doble-Booking','Nuestra infraestructura con PostgreSQL garantiza que nunca te agenden dos citas a la misma hora en sedes diferentes. Seguridad matemática.'],
['▣','Tu Enlace de Reserva Directo','Comparte tu link profesional en Instagram y WhatsApp. Tus clientes reservan según tu disponibilidad real sin cruce de mensajes.'],
['▦','Agenda y Horarios Autónomos','Define tus propios turnos, descansos y catálogo de servicios con duraciones y precios personalizados para cada ubicación.'],
['✧','Modular y Escalable','Activa sólo los módulos que necesitas: agenda, analítica, promociones, o liquidación financiera a medida que crece tu negocio.']
];
const steps=[
['01','CREAS TU ESPACIO SOLO','Registras tu perfil profesional, defines tus servicios y obtienes tu Workspace independiente como OWNER.'],
['02','TE AFILIAS A UNA SEDE','Envías solicitud a una o más barberías. La sede aprueba las ubicaciones físicas y el modelo de liquidación (alquiler de silla o comisión).'],
['03','ATIENDES CON CONCURRENCIA TOTAL','Recibes citas en cualquiera de tus sedes autorizadas o tu estudio propio sin riesgo de colisión ni solapamiento horario.']
];
const plans=[
{id:'SOLO_STARTER',name:'Solo Starter',price:'49.000',desc:'Ideal para barberos independientes que están consolidando su cartera propia.',items:['1 Workspace profesional propio','Agenda y calendario interactivo','Hasta 1 sede anfitriona afiliada','Directorio de hasta 150 clientes','Enlace público de reservas','Recordatorios de citas']},
{id:'SOLO_PRO',name:'Solo Pro',price:'89.000',desc:'Para profesionales con alto flujo que operan en múltiples barberías y buscan máxima autonomía.',hot:true,items:['Todo lo de Starter, más:','Afiliaciones multisede ilimitadas','Clientes ilimitados con ficha histórica','Métricas avanzadas de rendimiento','Catálogo completo de servicios personalizados','Protección multisede anti doble-booking','Soporte prioritario por WhatsApp']},
{id:'SOLO_ELITE',name:'Solo Elite',price:'149.000',desc:'Para referentes del sector, formadores y barberos de alta gama con marca personal.',items:['Todo lo de Pro, más:','Página web de marca personal con dominio','Módulo de promociones y campañas de fidelización','Pre-acceso a Asistente AI de agendamiento','Liquidación y reportes contables avanzados','Asesor dedicado para onboarding']}
];
function professionals(){return nav()+`<section class="pro-hero">
<span class="pro-label">✂ ESPACIO PARA BARBEROS INDEPENDIENTES</span>
<h1>TU TALENTO. TU MARCA.<span class="gradient">TU PROPIO ESPACIO COMERCIAL.</span></h1>
<p>Maneja tu propia agenda, clientes y tarifas. Trabaja en barberías anfitrionas con alquiler de silla o comisión, manteniendo el control absoluto de tu negocio.</p>
<div class="actions">${btn('CREAR MI ESPACIO GRATIS (14 DÍAS) →','/register/professional')}<a class="button secondary small" href="#planes">Ver Planes y Módulos</a></div>
<div class="subpoints"><span>✓ 14 días de prueba sin costo</span><span>✓ Sin tarjeta de crédito</span><span>✓ Cancela cuando quieras</span></div></section>
<section class="pro-features"><h2 class="section-title">DISEÑADO PARA TU INDEPENDENCIA</h2>
<p class="section-subtitle">No eres un simple empleado. Eres un profesional autónomo con tu propia empresa y clients.</p>
<div class="feature-grid">${benefits.map(([icon,title,desc])=>`<article class="feature-card"><div class="feature-symbol">${icon}</div><h3>${title}</h3><p>${desc}</p></article>`).join('')}</div></section>
<section class="affiliation"><div style="text-align:center"><span class="pro-label">RELACIÓN CON BARBERÍAS ANFITRIONAS</span></div><h2 class="section-title">¿CÓMO FUNCIONA EL MODELO AFILIADO?</h2>
<div class="steps">${steps.map(([n,title,desc])=>`<article class="step"><strong>${n}</strong><h3>${title}</h3><p>${desc}</p></article>`).join('')}</div></section>
<section class="plans" id="planes"><h2 class="section-title">PLANES PARA PROFESIONALES INDEPENDIENTES</h2>
<p class="section-subtitle">Elige el plan adaptado a tu etapa. Todos incluyen 14 días de prueba completa.</p>
<div class="plan-grid">${plans.map(p=>`<article class="plan ${p.hot?'featured':''}">${p.hot?'<span class="plan-badge">MÁS ELEGIDO</span>':''}
<h3>${p.name}</h3><p>${p.desc}</p><div class="price">$${p.price} <span>COP / mes</span></div><ul>${p.items.map(x=>`<li>${x}</li>`).join('')}</ul>
${btn('COMENZAR 14 DÍAS GRATIS','/register/professional?plan='+p.id)}</article>`).join('')}</div></section>
<section class="pro-end"><h2>LLEVA TU CARRERA PROFESIONAL AL SIGUIENTE NIVEL</h2>
<p>Únete a la nueva generación de barberos que operan con autonomía comercial, tecnología de punta y respaldo multisede.</p>
${btn('CREAR MI ESPACIO PROFESIONAL AHORA →','/register/professional')}</section>`+footer()}
function login(){return `<main class="login-bridge"><section class="login-bridge-card">${logo('login-bridge-logo')}<h1>BIENVENIDO<br><span style="color:#777">DE VUELTA</span></h1>
<p>Para iniciar sesión con tus credenciales verificadas, continúa en la aplicación BarberNow.</p>
<a class="button" href="${SYSTEM_LOGIN}">INICIAR SESIÓN →</a><p style="margin-top:30px"><a class="minor-link" href="/">VOLVER A LA PÁGINA WEB</a></p>
</section></main>`}
function registration(){
const professional=route.includes('professional');
const plan=new URLSearchParams(location.search).get('plan');
const selected=plans.find(p=>p.id===plan);
return `<main class="register"><header class="register-top">${brandLink()}<a href="/login" class="minor-link">¿Ya tienes cuenta? <span class="gold">Iniciar Sesión</span></a></header>
<section class="register-card"><div class="steps-note"><span id="step-num">Paso 1 de 3</span><span class="register-step">14 Días de Prueba Gratis</span></div>
<div class="eyebrow" id="step-tag">Datos de Acceso</div><h1 id="form-heading">CREA TU CUENTA DE ACCESO</h1>
<p id="form-desc">Tus credenciales personales para acceder a la plataforma y gestionar tu negocio.</p>
${selected?`<div class="directory-alert">Plan seleccionado: ${selected.name}. El cobro online todavía no está disponible.</div>`:''}
<form id="signup-form"><div class="fields" id="form-fields">
<label>Nombre Completo *<input name="name" required placeholder="Ej. Carlos Mendoza" autocomplete="name"/></label>
<label>Correo Electrónico *<input name="email" required type="email" placeholder="carlos@ejemplo.com" autocomplete="email"/></label>
<label>Teléfono / WhatsApp *<input name="phone" required placeholder="+57 300 123 4567" type="tel"/></label>
<label>Contraseña *<input name="password" required type="password" minlength="8" placeholder="Mínimo 8 caracteres" autocomplete="new-password"/></label></div>
<button class="button" type="submit" id="signup-next">CONTINUAR AL PERFIL →</button></form>
<p style="text-align:center;margin-top:70px;font-size:13px">© 2026 BarberNow. Todos los derechos reservados.</p></section></main>`}
function toast(text){const n=document.createElement('div');n.className='toast';n.textContent=text;document.body.appendChild(n);setTimeout(()=>n.remove(),4000)}
app.innerHTML=route==='/profesionales'?professionals():route==='/directorio'?directory():route==='/login'?login():route.startsWith('/register')?registration():home();
const menu=document.querySelector('#mobile-menu'),toggle=document.querySelector('#menu-btn');
toggle?.addEventListener('click',()=>{const open=menu.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'✕':'☰'});
const theme=()=>{document.body.classList.toggle('light-mode');sessionStorage.setItem('landing-light',String(document.body.classList.contains('light-mode')))};
if(sessionStorage.getItem('landing-light')==='true')document.body.classList.add('light-mode');
document.querySelector('#theme')?.addEventListener('click',theme);
document.querySelector('#theme-mobile')?.addEventListener('click',theme);
const navEl=document.querySelector('#main-nav');
if(navEl)window.addEventListener('scroll',()=>navEl.classList.toggle('solid',scrollY>40),{passive:true});
if(location.hash)setTimeout(()=>document.getElementById(location.hash.slice(1))?.scrollIntoView({behavior:'smooth'}),100);
const form=document.querySelector('#signup-form');
let step=1;
form?.addEventListener('submit',ev=>{
 ev.preventDefault();
 if(step===3){location.assign(SYSTEM_LOGIN);return}
 step++;document.querySelector('#step-num').textContent='Paso '+step+' de 3';
 const fields=document.querySelector('#form-fields'),heading=document.querySelector('#form-heading'),tag=document.querySelector('#step-tag'),desc=document.querySelector('#form-desc'),submit=document.querySelector('#signup-next');
 if(step===2){
  tag.textContent='Perfil Profesional';heading.textContent='CONFIGURA TU PERFIL';
  desc.textContent='Personaliza tu espacio y crea tu marca como profesional independiente.';
  fields.innerHTML='<label>Nombre de tu espacio *<input name="business" required placeholder="Ej. Barber Studio"/></label><label>Ciudad *<input name="city" required placeholder="Ej. Bogotá"/></label><label>Especialidad<input name="specialty" placeholder="Corte clásico y barba"/></label>';
  submit.textContent='CONTINUAR AL PLAN →';
 }else{
  tag.textContent='Confirmación';heading.textContent='COMIENZA TU ESPACIO';
  desc.textContent='Para activar tu cuenta y comenzar la prueba, continúa en el sistema BarberNow. Esta landing no procesa pagos.';
  fields.innerHTML='<div class="register-success">✓ Has completado la presentación. El registro y la activación seguros continúan en BarberNow.</div>';
  submit.textContent='IR A BARBERNOW →';
 }
 window.scrollTo({top:0,behavior:'smooth'});
});


/**
 * Movimiento de la landing de referencia: entrada escalonada de portada,
 * revelado progresivo de secciones al hacer scroll y llegada suave al pie.
 * No altera textos, dimensiones, rutas ni el logo de BarberNow.
 * En dispositivos con movimiento reducido, todo permanece visible.
 */
function enableLandingMotion() {
 if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
 const groups = [
  ['.hero', ['.eyebrow','h1','.description','.hero-buttons','.small-promote','.discover']],
  ['.about', ['.eyebrow','h2','p','.stats','.button','.about-picture']],
  ['.cta', ['.cta-tag','h2','p','.button','.note']],
  ['.pro-hero', ['.pro-label','h1','p','.actions','.subpoints']],
  ['.pro-features', ['.section-title','.section-subtitle','.feature-card']],
  ['.affiliation', ['.pro-label','.section-title','.step']],
  ['.plans', ['.section-title','.section-subtitle','.plan']],
  ['.pro-end', ['h2','p','.button']],
  ['.directory', ['.back-link','.directory-icon','.eyebrow','h1','.copy','.directory-alert']],
  ['.register', ['.register-top','.steps-note','.register-card']],
  ['.footer', ['.footer-grid > div','.footer-bottom']]
 ];
 const targets = [];
 for (const [parentSelector, childSelectors] of groups) {
  const parent = app.querySelector(parentSelector);
  if (!parent) continue;
  let sequence = 0;
  for (const selector of childSelectors) {
   for (const element of parent.querySelectorAll(selector)) {
    if (element.classList.contains('bn-reveal')) continue;
    element.classList.add('bn-reveal');
    element.style.setProperty('--bn-delay', Math.min(sequence++, 6) * 85 + 'ms');
    targets.push(element);
   }
  }
 }
 if (!targets.length) return;
 // Las clases se aplican antes del primer fotograma; jamás se oculta el
 // contenido cuando el navegador no admite IntersectionObserver.
 document.documentElement.classList.add('bn-motion');
 const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
   if (!entry.isIntersecting) continue;
   entry.target.classList.add('bn-visible');
   observer.unobserve(entry.target);
  }
 }, {threshold:0.08, rootMargin:'0px 0px -5% 0px'});
 targets.forEach(element => observer.observe(element));
}
enableLandingMotion();
