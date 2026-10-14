// Portable, bounded BarberOS backend delivery verification.
// npm run verify:delivery                 -> safe syntax/unit/security checks
// npm run verify:delivery -- --live       -> also real DB, HTTP E2E and concurrent bookings
// npm run verify:delivery -- --live --smoke -> additionally 450 bounded localhost reads
// npm run verify:delivery -- --realtime   -> optional diagnostics; requires --live
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const options=new Set(process.argv.slice(2));
const live=options.has('--live');
const realtime=options.has('--realtime');
if(realtime&&!live)throw Error('Use --realtime together with --live');
if([...options].some(v=>!['--live','--smoke','--realtime'].includes(v)))
  throw Error('Supported flags: --live, --smoke, --realtime');
if((live||options.has('--smoke'))&&(!existsSync(resolve(root,'.env'))||
  (live&&!existsSync(resolve(root,'.env.admin.local')))))
  throw Error('Live checks require ignored backend/.env and backend/.env.admin.local');
const node=process.execPath;
const envFiles=['--env-file=.env','--env-file=.env.admin.local'];
const tasks=[
  {name:'Full backend JavaScript syntax',command:'npm',args:['run','check']},
  {name:'All local unit and regression tests',command:'npm',args:['test']},
  {name:'Production dependency audit',command:'npm',args:['audit','--omit=dev','--audit-level=high']}
];
if(live)tasks.push(
  {name:'Actual PostgreSQL transaction constraints with rollback',
    args:[...envFiles,'--test','test/integration.test.js'],extra:{RUN_DB_INTEGRATION:'1'}},
  {name:'HTTP Auth, reservations, orders, refunds, schedules, Storage E2E',
    args:[...envFiles,'--test','test/live-api.test.js'],extra:{RUN_LIVE_API_INTEGRATION:'1'}},
  {name:'Roles, competing reservations, stock and idempotency E2E',
    args:[...envFiles,'--test','test/concurrency.test.js'],extra:{RUN_LIVE_CONCURRENCY:'1'}},
  {name:'Full backend health monitor',args:['scripts/health-monitor.mjs']}
);
if(options.has('--smoke'))tasks.push({name:'Bounded local 450-request smoke',
  args:['scripts/load-smoke.mjs']});
if(realtime)tasks.push({
  name:'Optional external Supabase WebSocket delivery diagnostic',
  args:[...envFiles,'--test','test/realtime.test.js'],extra:{RUN_LIVE_REALTIME:'1'}
});
const results=[];
for(const task of tasks){
  process.stdout.write('\n=== '+task.name+' ===\n');
  const isWinNpm=task.command==='npm'&&process.platform==='win32';
  const cmd=isWinNpm?'cmd.exe':(task.command||node);
  const args=isWinNpm?['/d','/s','/c','npm '+task.args.join(' ')]:task.args;
  const started=Date.now();
  const result=await new Promise(resolve=>{
    const p=spawn(cmd,args,{cwd:root,env:{...process.env,...task.extra},
      stdio:'inherit',windowsHide:true,shell:false});
    p.once('error',error=>resolve({exit:1,error:error.code||error.name}));
    p.once('close',code=>resolve({exit:code??1}));
  });
  results.push({check:task.name,passed:result.exit===0,elapsedSeconds:Math.round((Date.now()-started)/1000)});
}
const complete=results.every(x=>x.passed);
console.log('\nBARBEROS_DELIVERY_RESULT='+JSON.stringify({
  verifiedAt:new Date().toISOString(),
  scope:live?'real dedicated BarberOS Supabase and localhost API':'local safe tests',
  complete,results,
  notes:['Frontend not connected (mock adapter)','Wompi intentionally disabled',
    'Not a certification of public production hosting or sustained 1000-user load']
}));
if(!complete)process.exitCode=1;
