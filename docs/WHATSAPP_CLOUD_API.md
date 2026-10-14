# WhatsApp Cloud API — templates for Barber Paradise

This is a **separate, opt-in, disabled-by-default feature**. Do not enable outbound WhatsApp from development or production before the recipient, legal/commercial consent and Meta approvals are checked.

## Scope

- A business manager can configure four existing **approved** Meta template names (new reservation, reminder, reschedule and cancellation), locale and reminder lead time on **Perfil Comercial**.
- A customer can explicitly opt in during a real booking and revoke via **Mi Perfil**. The consent endpoint only accepts the phone associated with a booking owned by the authenticated user, using international numbers with country code.
- PostgreSQL migration `20261014000400_whatsapp_templates.sql` stores per-tenant disabled settings, tenant-scoped consents and idempotent queued messages. Appointment triggers queue new events and suppress stale reminders on rescheduling or cancellation.
- The backend worker checks the latest tenant setting, matching appointment status, phone and unrevoked consent **again immediately before sending**. An unknown delivery outcome is left for manual review to prevent automatic duplicate sends.
- Webhook `GET/POST /api/v1/whatsapp/webhook` verifies Meta challenge token and `X-Hub-Signature-256` HMAC over the exact raw POST body; it records incoming delivery statuses, never executes commands from inbound messages.

## Meta prerequisites

Use a Meta Business account with an approved WhatsApp Cloud API number and the correct access permissions; obtain:
- `WHATSAPP_ACCESS_TOKEN`: **server-side secret token**, never `VITE_` or committed
- `WHATSAPP_PHONE_NUMBER_ID`: Meta phone-number ID (numeric)
- `WHATSAPP_APP_SECRET`: webhook HMAC signature verification
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`: secret chosen for subscription verification
- `WHATSAPP_GRAPH_VERSION`: Meta Graph API version, default `v23.0` (verify the current supported version in Meta Developer Dashboard)
- `WHATSAPP_SEND_ENABLED=true`: **last explicit global activation switch**; defaults to `false`.

The Docker deployment takes values from *server environment variables*, with the token and webhook secrets kept outside the repository and outside the browser. For a multi-tenant SaaS this implementation uses **one platform-managed WhatsApp sender**; do not add per-tenant plaintext Meta tokens to PostgreSQL. If each business requires its own Meta number, plan a separate encrypted credentials vault and explicit routing per tenant.

## Template configuration

For each business, enter the template **name exactly as approved by Meta** and use the approved locale (for example `es_CO` only if the template was approved with that locale). The supported `params` keys are:

`customer_name`, `business_name`, `barber_name`, `service_name`, `date`, `time`.

Example settings (illustrative names, **not** claimed to be approved by Meta):

```json
{
  "enabled": false,
  "languageCode": "es_CO",
  "reminderHours": 24,
  "templates": {
    "created": {"name":"reserva_recibida","params":["customer_name","business_name","date","time"]},
    "reminder": {"name":"recordatorio_cita","params":["customer_name","business_name","date","time"]},
    "rescheduled": {"name":"cita_reprogramada","params":["customer_name","business_name","date","time"]},
    "cancelled": {"name":"cita_cancelada","params":["customer_name","business_name","date","time"]}
  }
}
```

The number, type and order of parameters must match the *approved* Meta template body. Templates are not created or approved by this API; the business must do that in WhatsApp Manager.

## Release plan

1. Review the feature branch and confirm all backend tests, TypeScript and builds pass. **Do not merge to main on QA success alone.**
2. Apply the migration to **isolated staging first**, then test a synthetic customer opt-in/opt-out and booking. Do not apply it blindly to live customer data.
3. Configure Meta test credentials server-side. Use Meta test numbers and pre-approved template names to verify API acceptance and webhook delivery statuses. No test should send to a real customer.
4. Confirm template locale/parameters, callback HTTPS domain, webhook `messages` subscription and Meta application secret.
5. Verify production server release and rollback plan; only then enable `WHATSAPP_SEND_ENABLED=true`, and separately enable each business. Watch failures and manual-review states.
6. For opt-out, always suppress future queued sends immediately; sending a cancellation notice after opt-out is not permitted.

**Limitations:** Meta acceptance is not identical to delivery. Internet timeouts can be ambiguous; this version marks ambiguous requests for manual review instead of automated retries. The client consent registration happens *after* a successful booking and may enqueue an initial notification then. Without consent no event is queued or delivered. Existing appointments are never bulk messaged on feature activation.

Meta documentation: https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api

See `docs/STABILIZATION_RELEASE_GATE.md` for the earlier completed five-priority release.
