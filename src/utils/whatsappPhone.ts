/** Normalize an explicitly opted-in customer's phone without guessing other countries. */
export function normalizeBookingWhatsAppPhone(value:string):string|null {
  const phone=value.trim().replace(/[\s().-]/g,'');
  // Colombian mobile phone written locally with ten digits.
  if(/^3\d{9}$/.test(phone))return '+57'+phone;
  if(/^57[1-9]\d{9}$/.test(phone))return '+'+phone;
  // Any other country requires an explicit +E.164 international prefix.
  if(/^\+[1-9]\d{7,14}$/.test(phone))return phone;
  return null;
}
