import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {registerNotificationRoutes} from '../src/notifications.js';

const user='11111111-1111-4111-8111-111111111111';
const stranger='22222222-2222-4222-8222-222222222222';
const tenant='33333333-3333-4333-8333-333333333333';
const time='2026-10-14T00:00:00.123456Z';
const items=[
  {id:'00000000-0000-4000-8000-000000000001',user_id:user},
  {id:'00000000-0000-4000-8000-000000000002',user_id:user},
  {id:'00000000-0000-4000-8000-000000000003',user_id:user},
  {id:'00000000-0000-4000-8000-000000000004',user_id:stranger}
].map(r=>({...r,tenant_id:tenant,category:'booking',reference_id:tenant,
 event_status:'pending',title:'Notification',body:'',created_at:new Date(time),cursor_time:time,read_at:null}));
async function fixture(){
 const db={query:async(sql,params)=>{
   if(!sql.includes('FROM public.notifications WHERE user_id=$1'))throw Error('Unexpected SQL');
   const [uid,afterTime,afterId,limit]=params;
   const result=items.filter(x=>x.user_id===uid&&
     (!afterTime||x.created_at.getTime()>Date.parse(afterTime)||
       (x.created_at.getTime()===Date.parse(afterTime)&&x.id>afterId)))
     .sort((a,b)=>a.created_at-b.created_at||a.id.localeCompare(b.id))
     .slice(0,limit);
   return {rows:result,rowCount:result.length};
 }};
 const security={authenticated:async req=>{req.actor={id:req.headers['x-test-user']||user};},
 limited:async()=>{}};
 const app=Fastify({logger:false});
 await registerNotificationRoutes(app,{db,security});
 await app.ready();
 return app;
}
test('Sync catch-up paginates identical timestamps without leaks or duplicates',async()=>{
 const app=await fixture();
 try{
   let cursor=null,seen=[];
   for(let i=0;i<4;i++){
     const url='/api/v1/me/notifications/sync?limit=1'+
       (cursor?'&cursor='+encodeURIComponent(cursor):'');
     const r=await app.inject({method:'GET',url});
     assert.equal(r.statusCode,200,r.payload);
     const page=r.json();
     assert.ok(page.items.length<=1);
     if(i===0){
       const decoded=JSON.parse(Buffer.from(page.nextCursor,'base64url').toString('utf8'));
       assert.equal(decoded[0],time,'Cursor must retain microsecond precision');
       assert.ok(!('cursor_time' in page.items[0]),'Internal cursor field must not be exposed');
     }
     seen.push(...page.items.map(x=>x.id));
     if(page.items.length===0)break;
     cursor=page.nextCursor;
   }
   assert.deepEqual(seen,items.filter(x=>x.user_id===user).map(x=>x.id));
   assert.equal(new Set(seen).size,3);
   const outsider=await app.inject({method:'GET',url:'/api/v1/me/notifications/sync',
     headers:{'x-test-user':stranger}});
   assert.equal(outsider.statusCode,200);
   assert.equal(outsider.json().items.length,1);
   assert.equal(outsider.json().items[0].id,items[3].id);
 }finally{await app.close();}
});
test('Sync catch-up refuses invalid cursors and excessive limits',async()=>{
 const app=await fixture();
 try {
   const malformed=await app.inject({method:'GET',
     url:'/api/v1/me/notifications/sync?cursor=%21%21%21'});
   assert.equal(malformed.statusCode,400,malformed.payload);
   const tooMuch=await app.inject({method:'GET',
     url:'/api/v1/me/notifications/sync?limit=1001'});
   assert.equal(tooMuch.statusCode,400,tooMuch.payload);
 }finally{await app.close();}
});
