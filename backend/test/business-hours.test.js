import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBusinessDays,normalizeBusinessHours,businessOpenOnDate,checkBusinessSlot,defaultWorkIntervals} from '../src/business-hours.js';

test('Spanish schedules use the actual business weekdays, including wraparound ranges',()=>{
 assert.deepEqual(parseBusinessDays('Lunes a Sábado'),[1,2,3,4,5,6]);
 assert.deepEqual(parseBusinessDays('Miércoles a Lunes'),[0,1,3,4,5,6]);
 assert.deepEqual(parseBusinessDays('Todos los días'),[0,1,2,3,4,5,6]);
 assert.deepEqual(parseBusinessDays('Sábado y domingo'),[0,6]);
 assert.equal(businessOpenOnDate({days:'Lunes a Sábado',open:'09:00',close:'22:00'},'2026-11-08'),false);
 assert.equal(businessOpenOnDate({days:'Miércoles a Lunes',open:'09:00',close:'20:00'},'2026-11-08'),true);
 assert.equal(businessOpenOnDate({days:'Miércoles a Lunes',open:'09:00',close:'20:00'},'2026-11-10'),false);
});

test('appointments must fit fully within shop opening and closing in Colombia timezone',()=>{
 const h={days:'Lunes a Sábado',open:'09:00',close:'22:00'};
 assert.equal(checkBusinessSlot(h,'America/Bogota','2026-11-07T14:00:00Z','2026-11-07T14:30:00Z'),true);
 assert.equal(checkBusinessSlot(h,'America/Bogota','2026-11-08T02:00:00Z','2026-11-08T02:50:00Z'),true);
 assert.equal(checkBusinessSlot(h,'America/Bogota','2026-11-08T02:45:00Z','2026-11-08T03:15:00Z'),false);
 assert.equal(checkBusinessSlot(h,'America/Bogota','2026-11-07T13:45:00Z','2026-11-07T14:15:00Z'),false);
 assert.equal(checkBusinessSlot(h,'America/Bogota','2026-11-08T14:00:00Z','2026-11-08T14:50:00Z'),false);
});
test('new barber default work intervals inherit real business hours, not 09:00 to 18:00',()=>{
 const h=normalizeBusinessHours({days:'Miércoles a Lunes',open:'09:00',close:'22:00'});
 const items=defaultWorkIntervals(h);
 assert.deepEqual(items.map(i=>i.weekday),[0,1,3,4,5,6]);
 assert.ok(items.every(i=>i.startMinute===540&&i.endMinute===1320));
 assert.throws(()=>normalizeBusinessHours({days:'Lunes a sábado',open:'22:00',close:'09:00'}),/cierre/i);
});
