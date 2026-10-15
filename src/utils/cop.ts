/** Whole COP amounts: no cents and no implicit currency conversions. */
export function formatCopDigits(value:number|null|undefined):string {
  return value == null || !Number.isSafeInteger(value) || value < 0
    ? '' : new Intl.NumberFormat('es-CO',{maximumFractionDigits:0}).format(value);
}

/** Return null for a blank/invalid amount so placeholders never become submitted values. */
export function parseCopDigits(value:string):number|null {
  const plain=value.replace(/[.\s]/g,'');
  if(!/^\d+$/.test(plain))return null;
  const amount=Number(plain);
  return Number.isSafeInteger(amount)&&amount>=0?amount:null;
}
