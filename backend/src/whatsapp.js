// WhatsApp Cloud API - approved utility template only.
export function normalizePhone(phone) {
  const digits = String(phone || '').replace(/[^\d]/g, '');
  if (digits.length < 10 || digits.length > 15) throw new Error('Invalid customer phone for WhatsApp');
  return digits;
}
export async function sendBookingConfirmation(settings, appointment, fetcher = fetch) {
  if (!settings.enabled) return { skipped: true };
  if (!settings.accessToken || !settings.phoneNumberId) throw new Error('WhatsApp credentials missing');
  const locale = settings.templateLanguage || 'es';
  const zone = appointment.time_zone || 'America/Bogota';
  const timestamp = new Date(appointment.starts_at);
  const date = new Intl.DateTimeFormat('es-CO',{dateStyle:'long',timeZone:zone}).format(timestamp);
  const time = new Intl.DateTimeFormat('es-CO',{timeStyle:'short',timeZone:zone}).format(timestamp);
  const url = 'https://graph.facebook.com/' + (settings.graphVersion || 'v23.0') + '/' + encodeURIComponent(settings.phoneNumberId) + '/messages';
  const response = await fetcher(url,{
    method:'POST',
    headers:{ Authorization:'Bearer '+settings.accessToken,'Content-Type':'application/json' },
    body:JSON.stringify({
      messaging_product:'whatsapp',
      to:normalizePhone(appointment.customer_phone),
      type:'template',
      template:{name:settings.templateName || 'barberos_booking_confirmation',
        language:{code:locale},
        components:[{type:'body',parameters:[
          {type:'text',text:appointment.customer_name},
          {type:'text',text:appointment.shop_name},
          {type:'text',text:date},
          {type:'text',text:time}
        ]}]
      }
    }),
    signal:AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error('WhatsApp Graph API HTTP '+response.status);
  const result = await response.json();
  if (!result.messages?.[0]?.id) throw new Error('WhatsApp response missing message id');
  return { messageId:result.messages[0].id };
}
