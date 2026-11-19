import React,{useId,useState} from 'react';
import {Eye,EyeOff} from 'lucide-react';

type Props=Omit<React.InputHTMLAttributes<HTMLInputElement>,'type'> & {
  /** Accessible description identifying the field (for example, "contraseña actual"). */
  fieldLabel?:string;
};

/**
 * Shared password input. The value and the validation still belong to the
 * surrounding form; revealing it never submits or changes the value.
 */
export const PasswordInput:React.FC<Props>=({id,className='',style,fieldLabel='contraseña',disabled,...inputProps})=>{
  const [visible,setVisible]=useState(false);
  const generatedId=useId();
  const inputId=id||generatedId;
  return <div className="relative w-full">
    <input {...inputProps} id={inputId} disabled={disabled}
      type={visible?'text':'password'}
      className={className}
      style={{...style,paddingRight:'3.5rem'}}/>
    <button type="button" disabled={disabled}
      aria-controls={inputId}
      aria-pressed={visible}
      aria-label={visible?'Ocultar '+fieldLabel:'Mostrar '+fieldLabel}
      title={visible?'Ocultar '+fieldLabel:'Mostrar '+fieldLabel}
      onClick={()=>setVisible(prev=>!prev)}
      className="absolute right-2 top-1/2 z-[1] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-white/10 hover:text-[var(--gold-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--gold-primary)] disabled:cursor-not-allowed disabled:opacity-50">
      {visible?<EyeOff size={19} aria-hidden="true"/>:<Eye size={19} aria-hidden="true"/>}
    </button>
  </div>;
};