// Keep the public landing and the authenticated SPA isolated at the CSS/module level.
// Every route is served from the same origin (including /login and hash-based workspaces).
const pathname=window.location.pathname.replace(/\/+$/, '') || '/';
const publicPages=new Set(['/','/directorio','/profesionales','/register','/register/professional']);
const legacySystemLink=/^#\/(login|barberia|barbero|clientes|admin|vincular)(\/|$)/.test(window.location.hash) || /^#(?:access_token|error|type)=/.test(window.location.hash);
if(publicPages.has(pathname) && !legacySystemLink){
  document.title='BarberNow';
  const outfit=document.createElement('link');
  outfit.rel='stylesheet';
  outfit.href='https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap';
  document.head.appendChild(outfit);
  const element=document.getElementById('root');
  if(element)element.id='app';
  void import('../landing/app.js');
}else{
  void import('./react-entry.tsx');
}
