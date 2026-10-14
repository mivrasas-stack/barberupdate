import {useEffect,useState} from 'react';
import {isLiveBackend,listCustomerLinks,type CustomerLink} from './liveBackend';

export function useCustomerLinks(userId?:string){
 const [items,setItems]=useState<CustomerLink[]>([]);
 const [loading,setLoading]=useState(true);
 const [profile,setProfile]=useState<{full_name:string;phone:string}|null>(null);
 useEffect(()=>{
   if(!isLiveBackend||!userId){setItems([]);setLoading(false);return}
   let alive=true;
   const refresh=()=>{
     void listCustomerLinks().then(result=>{
       if(alive){setItems(result.items);setProfile(result.profile);setLoading(false)}
     }).catch(()=>{if(alive){setLoading(false);setItems([])}});
   };
   refresh();window.addEventListener('barberos-links-updated',refresh);
   return()=>{alive=false;window.removeEventListener('barberos-links-updated',refresh)};
 },[userId]);
 return {items,loading,profile};
}
