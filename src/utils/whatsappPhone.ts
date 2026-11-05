/**
 * Book a WhatsApp notice using the phone already stored in the customer profile.
 * Colombian mobile numbers are entered as 10 digits; country code is added only
 * for the API. Reject invalid +57 lengths instead of sending to a wrong number.
 * Non-Colombian numbers must be explicitly written in E.164.
 */
export function normalizeBookingWhatsAppPhone(value:string):string|null {
  if(typeof value!=='string')return null;
  const phone=value.trim().replace(/[\s().-]/g,'');
  if(/^3[0-9]{9}$/.test(phone))return '+57'+phone;
  if(/^\+?573[0-9]{9}$/.test(phone))return '+'+phone.replace(/^\+/,'');
  // Invalid Colombian numbers must not pass the generic E.164 fallback.
  if(/^\+?57/.test(phone)||/^3/.test(phone))return null;
  if(/^\+[1-9][0-9]{7,14}$/.test(phone))return phone;
  return null;
}
