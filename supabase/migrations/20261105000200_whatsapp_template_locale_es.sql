-- Approved Meta WhatsApp templates may use the base locale 'es' instead of 'es_CO'.
-- Preserve both representations; clients must send the exact approved language.
ALTER TABLE public.whatsapp_tenant_settings
  DROP CONSTRAINT IF EXISTS whatsapp_tenant_settings_language_code_check;
ALTER TABLE public.whatsapp_tenant_settings
  ADD CONSTRAINT whatsapp_tenant_settings_language_code_check
    CHECK (language_code ~ '^[a-z]{2,3}(_[A-Z]{2})?$');
