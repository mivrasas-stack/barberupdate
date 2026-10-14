-- WhatsApp Cloud API: opt-in, tenant-specific approved-template mapping, and durable jobs.
-- OFF BY DEFAULT: no outbound traffic until operator explicitly enables a tenant and
-- server env WHATSAPP_SEND_ENABLED=true is present.
BEGIN;

CREATE TABLE public.whatsapp_tenant_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  language_code text NOT NULL DEFAULT 'es_CO'
    CHECK (language_code ~ '^[a-z]{2,3}_[A-Z]{2}$'),
  reminder_hours integer NOT NULL DEFAULT 24 CHECK (reminder_hours BETWEEN 1 AND 168),
  templates jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(templates)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.whatsapp_consents (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  phone_e164 text NOT NULL CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  source text NOT NULL DEFAULT 'customer_portal'
    CHECK (source IN ('customer_portal')),
  consented_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (tenant_id,user_id,phone_e164)
);
CREATE INDEX whatsapp_consents_user ON public.whatsapp_consents(user_id,tenant_id);

CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  phone_e164 text NOT NULL CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  event_kind text NOT NULL
    CHECK (event_kind IN ('created','reminder','rescheduled','cancelled')),
  event_version integer NOT NULL DEFAULT 0 CHECK (event_version BETWEEN 0 AND 100),
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','sending','sent','delivered','read','failed','suppressed','manual_review')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 12),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  provider_message_id text UNIQUE,
  failure_code text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id,appointment_id,event_kind,event_version)
);
CREATE INDEX whatsapp_jobs_due ON public.whatsapp_messages(next_attempt_at,scheduled_at,id)
  WHERE status='queued';
CREATE INDEX whatsapp_jobs_appt ON public.whatsapp_messages(tenant_id,appointment_id);

-- No direct browser access: the authenticated API and isolated worker are the only writers.
ALTER TABLE public.whatsapp_tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_tenant_settings,public.whatsapp_consents,public.whatsapp_messages
  FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.whatsapp_tenant_settings,public.whatsapp_consents,
  public.whatsapp_messages TO barberos_backend;
CREATE POLICY whatsapp_settings_backend ON public.whatsapp_tenant_settings FOR ALL
  TO barberos_backend USING(true) WITH CHECK(true);
CREATE POLICY whatsapp_consents_backend ON public.whatsapp_consents FOR ALL
  TO barberos_backend USING(true) WITH CHECK(true);
CREATE POLICY whatsapp_messages_backend ON public.whatsapp_messages FOR ALL
  TO barberos_backend USING(true) WITH CHECK(true);

-- Queue is idempotent per appointment/event/revision and deliberately carries
-- no rendered body or Meta access token. Phone is stored only behind backend RLS.
CREATE OR REPLACE FUNCTION public.barberos_whatsapp_queue_appointment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cfg public.whatsapp_tenant_settings%ROWTYPE;
DECLARE kind text;
DECLARE revision integer := 0;
DECLARE when_at timestamptz := now();
DECLARE number text;
BEGIN
  -- Disable outstanding reminders immediately after cancellation/completion.
  IF TG_OP='UPDATE' AND
    (NEW.status NOT IN ('pending','confirmed') OR NEW.starts_at IS DISTINCT FROM OLD.starts_at) THEN
    UPDATE public.whatsapp_messages SET status='suppressed',updated_at=now()
    WHERE tenant_id=NEW.tenant_id AND appointment_id=NEW.id
      AND status='queued' AND event_kind='reminder';
  END IF;
  IF NEW.customer_user_id IS NULL OR NEW.starts_at<=now() THEN RETURN NEW; END IF;
  SELECT * INTO cfg FROM public.whatsapp_tenant_settings
    WHERE tenant_id=NEW.tenant_id AND enabled=true;
  IF NOT FOUND THEN RETURN NEW; END IF;
  number:=regexp_replace(NEW.customer_phone,'[[:space:]().-]','','g');
  IF number !~ '^\+[1-9][0-9]{7,14}$' THEN RETURN NEW; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.whatsapp_consents c
    WHERE c.tenant_id=NEW.tenant_id AND c.user_id=NEW.customer_user_id
      AND c.phone_e164=number AND c.revoked_at IS NULL) THEN RETURN NEW; END IF;

  IF TG_OP='INSERT' AND NEW.status IN ('pending','confirmed') THEN
    kind:='created';
  ELSIF TG_OP='UPDATE' AND NEW.status='cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    kind:='cancelled';
  ELSIF TG_OP='UPDATE' AND NEW.starts_at IS DISTINCT FROM OLD.starts_at
      AND NEW.status IN ('pending','confirmed') THEN
    kind:='rescheduled';
    revision:=NEW.reschedule_count;
  ELSE
    kind:=NULL;
  END IF;
  IF kind IS NOT NULL AND COALESCE(cfg.templates->kind->>'name','')<>'' THEN
    INSERT INTO public.whatsapp_messages(tenant_id,appointment_id,user_id,phone_e164,
      event_kind,event_version,scheduled_at)
    VALUES(NEW.tenant_id,NEW.id,NEW.customer_user_id,number,kind,revision,now())
    ON CONFLICT(tenant_id,appointment_id,event_kind,event_version) DO NOTHING;
  END IF;

  IF NEW.status IN ('pending','confirmed') AND
    COALESCE(cfg.templates->'reminder'->>'name','')<>'' AND
    NEW.starts_at>now()+make_interval(hours=>cfg.reminder_hours) THEN
    INSERT INTO public.whatsapp_messages(tenant_id,appointment_id,user_id,phone_e164,
      event_kind,event_version,scheduled_at)
    VALUES(NEW.tenant_id,NEW.id,NEW.customer_user_id,number,'reminder',
      NEW.reschedule_count,NEW.starts_at-make_interval(hours=>cfg.reminder_hours))
    ON CONFLICT(tenant_id,appointment_id,event_kind,event_version) DO NOTHING;
  END IF;
  RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.barberos_whatsapp_queue_appointment() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER appt_whatsapp_enqueue AFTER INSERT OR UPDATE OF status,starts_at,ends_at,barber_id
  ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.barberos_whatsapp_queue_appointment();

-- Explicit opt-out immediately cancels unsent jobs, even for existing appointments.
CREATE OR REPLACE FUNCTION public.barberos_whatsapp_revoke_jobs()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NEW.revoked_at IS NOT NULL AND OLD.revoked_at IS NULL THEN
    UPDATE public.whatsapp_messages SET status='suppressed',updated_at=now()
    WHERE tenant_id=NEW.tenant_id AND user_id=NEW.user_id
      AND phone_e164=NEW.phone_e164 AND status='queued';
  END IF;
  RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.barberos_whatsapp_revoke_jobs() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER whatsapp_revoke_jobs AFTER UPDATE OF revoked_at ON public.whatsapp_consents
  FOR EACH ROW EXECUTE FUNCTION public.barberos_whatsapp_revoke_jobs();
COMMIT;
