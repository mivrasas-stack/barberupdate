const {chromium}=require('@playwright/test');
const fs=require('fs');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const rows=[];
 const paths=['/','/directorio','/profesionales','/register/professional','/login'];
 for(const mode of ['desktop','mobile']){
  const viewport=mode==='desktop'?{width:1440,height:900}:{width:390,height:844};
  for(const path of paths){
   const pg=await browser.newPage({viewport});
   const errs=[];pg.on('pageerror',e=>errs.push(e.message));
   const response=await pg.goto('http://127.0.0.1:9102'+path,{waitUntil:'domcontentloaded',timeout:20000});
   await pg.waitForTimeout(400);
   const details=await pg.evaluate(()=>({title:document.title,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,height:document.documentElement.scrollHeight,headings:[...document.querySelectorAll('h1,h2')].slice(0,6).map(x=>x.textContent.trim()),images:[...document.querySelectorAll('img')].map(x=>({ok:x.complete&&x.naturalWidth>0,src:x.src})),bodyText:document.body.innerText.slice(0,90)}));
   assert.equal(response.status(),200,mode+' '+path+' status');
   assert.equal(details.title,'BarberNow',mode+' '+path+' title');
   assert(details.scrollWidth<=details.clientWidth+2,mode+' '+path+' horizontal overflow '+details.scrollWidth);
   assert.deepEqual(errs,[],mode+' '+path+' JS errors');
   assert(details.images.every(x=>x.ok),mode+' '+path+' failed image');
   fs.mkdirSync(__dirname+'/artifacts',{recursive:true});
   const filename=__dirname+'/artifacts/landing-review-'+(path==='/'?'home':path.slice(1).replaceAll('/','-'))+'-'+mode+'.png';
   if(path==='/'||path==='/profesionales'||path==='/directorio'){
      for(let y=0;y<details.height;y+=630){await pg.evaluate(v=>scrollTo(0,v),y);await pg.waitForTimeout(30)}
      await pg.evaluate(()=>scrollTo(0,0));
      await pg.screenshot({path:filename,fullPage:true,animations:'disabled'});
   }
   rows.push({mode,path,height:details.height,headings:details.headings,images:details.images.length,errors:errs.length});
   await pg.close();
  }
 }
 const p=await browser.newPage({viewport:{width:1440,height:900}});
 await p.goto('http://127.0.0.1:9102/');
 await p.getByRole('link',{name:'DIRECTORIO'}).click();
 assert.equal(new URL(p.url()).pathname,'/directorio');
 await p.getByRole('link',{name:/Volver al inicio/}).click();
 assert.equal(new URL(p.url()).pathname,'/');
 await p.getByRole('link',{name:'PROFESIONALES'}).click();
 assert.equal(new URL(p.url()).pathname,'/profesionales');
 await p.getByRole('link',{name:/COMENZAR 14 DÍAS GRATIS/}).first().click();
 assert(new URL(p.url()).pathname==='/register/professional');
 assert.equal(new URL(p.url()).searchParams.get('plan'),'SOLO_STARTER');
 await p.getByPlaceholder('Ej. Carlos Mendoza').fill('Usuario Prueba');
 await p.getByPlaceholder('carlos@ejemplo.com').fill('prueba@example.com');
 await p.getByPlaceholder('+57 300 123 4567').fill('3001234567');
 await p.getByPlaceholder('Mínimo 8 caracteres').fill('DemoSeguro2026!');
 await p.getByRole('button',{name:/CONTINUAR AL PERFIL/}).click();
 await p.getByPlaceholder('Ej. Barber Studio').fill('Barberia Prueba');
 await p.getByPlaceholder('Ej. Bogotá').fill('Bogotá');
 await p.getByRole('button',{name:/CONTINUAR AL PLAN/}).click();
 assert(await p.getByText('COMIENZA TU ESPACIO').count());
 assert(await p.getByRole('button',{name:/IR A BARBERNOW/}).count());
 await p.close();
 const mob=await browser.newPage({viewport:{width:390,height:844}});
 await mob.goto('http://127.0.0.1:9102/');
 await mob.getByRole('button',{name:'Abrir menú'}).click();
 assert(await mob.getByRole('link',{name:'Directorio'}).count());
 await mob.getByRole('link',{name:'Directorio'}).click();
 assert.equal(new URL(mob.url()).pathname,'/directorio');
 await mob.close();
 await browser.close();
 fs.writeFileSync(__dirname+'/artifacts/landing-review-results.json',JSON.stringify(rows,null,2));
 console.log('LANDING_PLAYWRIGHT_PASS=YES');
 console.log('LANDING_ROUTES_TESTED='+rows.length);
 console.log('LANDING_METRICS='+JSON.stringify(rows));
})().catch(e=>{console.error('LANDING_PLAYWRIGHT_FAIL='+e.stack);process.exitCode=1});