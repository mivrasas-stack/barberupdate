import {failure} from './security.js';

const WEEKDAYS=['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
const normalize=value=>String(value||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const timeMinutes=value=>{
  if(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    failure(400,'La hora de atención debe tener un formato válido');
  const [hours,minutes]=value.split(':').map(Number);
  return hours*60+minutes;
};

/** A backwards-compatible parser for existing Spanish labels, including cyclic ranges. */
export function parseBusinessDays(days){
  const normalized=normalize(days);
  if(normalized==='todos los dias'||normalized==='todos los días'||normalized==='lunes a domingo')
    return [0,1,2,3,4,5,6];
  const matches=[...normalized.matchAll(/domingo|lunes|martes|miercoles|jueves|viernes|sabado/g)]
    .map(match=>WEEKDAYS.indexOf(match[0]));
  if(!matches.length)failure(400,'Selecciona días de atención válidos');
  // "Miércoles a lunes" wraps over Sunday; "lunes a sábado" does not.
  if(matches.length===2&&/\s+a\s+/.test(normalized)){
    const result=[matches[0]];
    let day=matches[0];
    while(day!==matches[1]&&result.length<7){day=(day+1)%7;result.push(day);}
    return result.sort((a,b)=>a-b);
  }
  if(matches.length===1||matches.length>=2&&/\s*(?:,|\by\b)\s*/.test(normalized))
    return [...new Set(matches)].sort((a,b)=>a-b);
  failure(400,'Utiliza una selección válida de días de atención');
}
export function normalizeBusinessHours(input){
  const source=input||{days:'Lunes a Sábado',open:'09:00',close:'20:00'};
  const open=String(source.open||'09:00');
  const close=String(source.close||'20:00');
  const start=timeMinutes(open),end=timeMinutes(close);
  if(start>=end)failure(400,'La hora de cierre debe ser posterior a la apertura');
  const weekdays=Array.isArray(source.weekdays)&&source.weekdays.length
    ? [...new Set(source.weekdays)].sort((a,b)=>a-b)
    : parseBusinessDays(source.days);
  if(!weekdays.length||weekdays.some(day=>!Number.isInteger(day)||day<0||day>6))
    failure(400,'Selecciona días de atención válidos');
  return {days:source.days||'Lunes a Sábado',open,close,weekdays,startMinute:start,endMinute:end};
}
export function businessOpenOnDate(hours,dateString){
  const {weekdays}=normalizeBusinessHours(hours);
  const day=new Date(dateString+'T12:00:00Z').getUTCDay();
  return weekdays.includes(day);
}
export function checkBusinessSlot(hours,zone,startsAt,endsAt){
  const h=normalizeBusinessHours(hours);
  const formatter=new Intl.DateTimeFormat('en-GB',{
    timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  });
  const local=date=>{
    const parts=Object.fromEntries(formatter.formatToParts(new Date(date))
      .filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
    return {date:parts.year+'-'+parts.month+'-'+parts.day,
      weekday:new Date(parts.year+'-'+parts.month+'-'+parts.day+'T12:00:00Z').getUTCDay(),
      minutes:Number(parts.hour)*60+Number(parts.minute)};
  };
  const first=local(startsAt),last=local(endsAt);
  return first.date===last.date && h.weekdays.includes(first.weekday)
    && first.minutes>=h.startMinute && last.minutes<=h.endMinute;
}
export function defaultWorkIntervals(hours){
  const h=normalizeBusinessHours(hours);
  return h.weekdays.map(weekday=>({weekday,startMinute:h.startMinute,endMinute:h.endMinute}));
}
