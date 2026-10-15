import {useEffect,useState} from 'react';

export const AGENDA_ZONE='America/Bogota';

/** Calendar dates never use UTC slicing or a machine's locale/time zone. */
export function todayInBogota(instant:Date=new Date()):string{
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:AGENDA_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(instant);
 const part=(type:string)=>parts.find(x=>x.type===type)?.value||'00';
 return [part('year'),part('month'),part('day')].join('-');
}
export function shiftAgendaDate(iso:string,offset:number):string{
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
 if(!match)throw new Error('Fecha inválida');
 const date=new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3])+offset));
 return date.toISOString().slice(0,10);
}
export function rollingAgendaDays(base:string,today:string){
 return Array.from({length:7},(_,index)=>{
  const date=shiftAgendaDate(base,index);
  const d=new Date(date+'T12:00:00Z');
  return {
   date,dayName:new Intl.DateTimeFormat('es-CO',{weekday:'long',timeZone:'UTC'}).format(d),
   shortName:new Intl.DateTimeFormat('es-CO',{weekday:'short',timeZone:'UTC'}).format(d),
   dayNumber:Number(date.slice(8,10)),
   monthName:new Intl.DateTimeFormat('es-CO',{month:'short',timeZone:'UTC'}).format(d),
   isToday:date===today
  };
 });
}

/** Follows the current Colombian day until a user explicitly browses another date.
 * Background-tab and midnight changes are handled without reloading the page. */
export function useRollingAgendaDate(){
 const [today,setToday]=useState(()=>todayInBogota());
 const [selectedDate,setSelectedDate]=useState(()=>todayInBogota());
 const [followsToday,setFollowsToday]=useState(true);
 useEffect(()=>{
  const tick=()=>{
   const next=todayInBogota();
   setToday(old=>old===next?old:next);
   if(followsToday)setSelectedDate(old=>old===next?old:next);
  };
  const interval=window.setInterval(tick,30_000);
  document.addEventListener('visibilitychange',tick);
  window.addEventListener('focus',tick);
  return()=>{
   window.clearInterval(interval);
   document.removeEventListener('visibilitychange',tick);
   window.removeEventListener('focus',tick);
  };
 },[followsToday]);
 const browse=(date:string)=>{setFollowsToday(false);setSelectedDate(date);};
 const goToday=()=>{const fresh=todayInBogota();setToday(fresh);setFollowsToday(true);setSelectedDate(fresh);};
 return {today,selectedDate,setSelectedDate:browse,goToday,followsToday};
}
