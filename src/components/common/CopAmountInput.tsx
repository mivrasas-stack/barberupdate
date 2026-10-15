import React,{useState} from 'react';
import {formatCopDigits,parseCopDigits} from '../../utils/cop';

type Props={
  value:number|null|undefined;
  onChange:(value:number|null)=>void;
  required?:boolean;
  className?:string;
  placeholder?:string;
  ariaLabel?:string;
  disabled?:boolean;
};

/** COP amount input: blank by default, "0" as placeholder, separators on blur. */
export const CopAmountInput:React.FC<Props>=({
 value,onChange,required=false,className='',placeholder='0',ariaLabel,disabled=false
})=>{
 const [focused,setFocused]=useState(false);
 const display=value==null?'':focused?String(value):formatCopDigits(value);
 return <div className={'flex w-full items-center gap-2 focus-within:border-[var(--gold-primary)] '+className}>
   <span className="shrink-0 text-neutral-400 font-mono" aria-hidden="true">$</span>
   <input type="text" inputMode="numeric" autoComplete="off" required={required}
     aria-label={ariaLabel} disabled={disabled} placeholder={placeholder}
     value={display}
     onFocus={()=>setFocused(true)}
     onBlur={()=>setFocused(false)}
     onChange={e=>{
       const next=parseCopDigits(e.target.value);
       if(e.target.value.trim()!==''&&next===null)return;
       onChange(next);
     }}
     className="w-full min-w-0 flex-1 bg-transparent text-white font-mono outline-none placeholder:text-neutral-500"
   />
   <span className="shrink-0 text-[10px] font-bold text-neutral-500" aria-hidden="true">COP</span>
 </div>;
};
