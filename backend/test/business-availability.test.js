import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {registerSchedulingRoutes} from '../src/scheduling.js';

const tenant='11111111-1111-4111-8111-111111111111';
const barber='22222222-2222-4222-8222-222222222222';
const service='33333333-3333-4333-8333-333333333333';
const futureWeekday=weekday=>{
 const date=new Date(Date.now()+14*86400000);
 date.setUTCDate(date.getUTCDate()+(weekday-date.getUTCDay()+7)%7);
 return date.toISOString().slice(0,10);
};

test('availability SQL uses the business opening and closing times instead of the barber preset',async()=>{
 const app=Fastify();
 const queries=[];
 const db={query:async(sql,args)=>{
   queries.push({sql,args});
   if(sql.includes('SELECT opening_hours FROM public.tenants'))
     return {rowCount:1,rows:[{opening_hours:{days:'Lunes a Sábado',open:'09:00',close:'22:00'}}]};
   if(sql.includes('SELECT g.starts_at,g.ends_at'))return {rowCount:0,rows:[]};
   throw Error('unexpected SQL '+sql);
 }};
 await registerSchedulingRoutes(app,{db,security:{limited:async()=>{},authenticated:async()=>{},requireTenant:async()=>{}}});
 try{
   const url=day=>'/api/v1/public/tenants/'+tenant+'/availability?barberId='+barber+'&serviceId='+service+'&date='+day;
   const opened=await app.inject({method:'GET',url:url(futureWeekday(6))});
   assert.equal(opened.statusCode,200,opened.body);
   const scheduleQuery=queries.find(x=>x.sql.includes('generate_series'));
   assert.ok(scheduleQuery,'The database must calculate availability');
   assert.deepEqual(scheduleQuery.args.slice(4),[540,1320]);
   assert.match(scheduleQuery.sql,/GREATEST\(w.start_minute,\$5::integer\)/);
   assert.match(scheduleQuery.sql,/LEAST\(w.end_minute,\$6::integer\)/);
   queries.length=0;
   const closed=await app.inject({method:'GET',url:url(futureWeekday(0))});
   assert.equal(closed.statusCode,200,closed.body);
   assert.deepEqual(closed.json().slots,[]);
   assert.ok(!queries.some(x=>x.sql.includes('generate_series')),'Closed Sunday cannot expose bookable hours');
 }finally{await app.close();}
});
