BEGIN;

-- Called only by the API, with the identity from the authenticated request.
CREATE FUNCTION public.barbernow_staff_contact(actor uuid, shop uuid, mobile text, alerts boolean)
RETURNS TABLE(phone text, confirmed boolean, barber_id uuid, enabled boolean, template_ready boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  metadata jsonb;
  professional public.barbers%ROWTYPE;
  previous_phone text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenants t
    JOIN public.tenant_members m ON m.tenant_id=t.id AND m.user_id=actor
    WHERE t.id=shop AND t.status='active' AND (
      (t.owner_user_id=actor AND m.role='owner') OR
      (m.role IN ('barber','owner') AND EXISTS (SELECT 1 FROM public.barbers b
       WHERE b.tenant_id=shop AND b.user_id=actor AND b.status='active'))))
  THEN RAISE insufficient_privilege; END IF;

  IF mobile IS NULL THEN
    SELECT u.raw_user_meta_data INTO STRICT metadata FROM auth.users u WHERE u.id=actor;
  ELSE
    IF mobile !~ '^\+[1-9][0-9]{7,14}$' OR (mobile LIKE '+57%' AND mobile !~ '^\+573[0-9]{9}$')
    THEN RAISE invalid_parameter_value; END IF;
    UPDATE auth.users u SET raw_user_meta_data=COALESCE(u.raw_user_meta_data,'{}'::jsonb)
      || jsonb_build_object('phone',mobile,'barbernow_staff_contact_v1',true), updated_at=now()
      WHERE u.id=actor RETURNING u.raw_user_meta_data INTO STRICT metadata;
  END IF;

  SELECT b.* INTO professional FROM public.barbers b
    WHERE b.user_id=actor AND b.tenant_id=shop AND b.status='active' ORDER BY b.id LIMIT 1;
  IF mobile IS NOT NULL THEN
    IF alerts IS TRUE AND professional.id IS NULL THEN RAISE invalid_parameter_value; END IF;
    -- One account phone across its own profiles. Consent remains per professional.
    UPDATE public.barbers b SET professional_phone=mobile,whatsapp_phone=mobile,
      whatsapp_opt_in=CASE WHEN b.id=professional.id THEN COALESCE(alerts,b.whatsapp_opt_in) ELSE b.whatsapp_opt_in END
      WHERE b.user_id=actor AND (b.professional_phone IS DISTINCT FROM mobile
        OR b.whatsapp_phone IS DISTINCT FROM mobile OR
        (b.id=professional.id AND alerts IS NOT NULL AND b.whatsapp_opt_in IS DISTINCT FROM alerts));
    UPDATE public.whatsapp_messages m SET status='suppressed',failure_code='barber_contact_changed',updated_at=now()
      FROM public.appointments a
      WHERE a.id=m.appointment_id AND a.tenant_id=m.tenant_id AND m.user_id=actor
        AND m.event_kind='barber_created' AND m.status='queued'
        AND (m.phone_e164 IS DISTINCT FROM mobile OR (a.barber_id=professional.id AND alerts IS FALSE));
    professional.whatsapp_phone:=mobile;
    professional.professional_phone:=mobile;
    professional.whatsapp_opt_in:=COALESCE(alerts,professional.whatsapp_opt_in);
  END IF;

  previous_phone:=NULLIF(metadata->>'phone','');
  RETURN QUERY SELECT COALESCE(CASE WHEN professional.whatsapp_opt_in THEN NULLIF(professional.whatsapp_phone,'') END,
     previous_phone,NULLIF(professional.professional_phone,''),NULLIF(professional.whatsapp_phone,''),''),
    COALESCE(metadata->>'barbernow_staff_contact_v1'='true' AND previous_phone IS NOT NULL
       AND (professional.id IS NULL OR (professional.professional_phone=previous_phone AND professional.whatsapp_phone=previous_phone)),false),
    professional.id, COALESCE(professional.whatsapp_opt_in,false),
    EXISTS (SELECT 1 FROM public.whatsapp_tenant_settings s WHERE s.tenant_id=shop
      AND s.enabled AND NULLIF(s.templates->'barber_created'->>'name','') IS NOT NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.barbernow_staff_contact(uuid,uuid,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.barbernow_staff_contact(uuid,uuid,text,boolean) TO barberos_backend;
-- Keep booking-time eligibility aligned with the contact form for international mobiles.
CREATE OR REPLACE FUNCTION public.barberos_whatsapp_queue_barber_appointment()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  barber_record record;
  assigned_phone text;
BEGIN
  IF NEW.status <> 'confirmed' OR NEW.starts_at<=now() THEN RETURN NEW; END IF;

  SELECT b.user_id,b.whatsapp_phone,b.whatsapp_opt_in,b.status,
         t.status AS tenant_status,
         c.enabled AS whatsapp_enabled,
         c.templates->'barber_created'->>'name' AS template_name
  INTO barber_record
  FROM public.barbers b
  JOIN public.tenants t ON t.id=b.tenant_id
  LEFT JOIN public.whatsapp_tenant_settings c ON c.tenant_id=b.tenant_id
  WHERE b.tenant_id=NEW.tenant_id AND b.id=NEW.barber_id;

  IF barber_record.user_id IS NULL OR barber_record.whatsapp_opt_in IS DISTINCT FROM true
     OR barber_record.status<>'active' OR barber_record.tenant_status<>'active'
     OR barber_record.whatsapp_enabled IS DISTINCT FROM true
     OR COALESCE(barber_record.template_name,'')=''
  THEN RETURN NEW; END IF;

  -- Only a valid canonical destination opted in by the professional is accepted.
  assigned_phone:=regexp_replace(COALESCE(barber_record.whatsapp_phone,''),'[[:space:]().-]','','g');
  IF assigned_phone ~ '^3[0-9]{9}$' THEN assigned_phone:='+57'||assigned_phone; END IF;
  IF assigned_phone ~ '^573[0-9]{9}$' THEN assigned_phone:='+'||assigned_phone; END IF;
  IF assigned_phone !~ '^[+][1-9][0-9]{7,14}$'
     OR (assigned_phone LIKE '+57%' AND assigned_phone !~ '^[+]573[0-9]{9}$') THEN RETURN NEW; END IF;

  INSERT INTO public.whatsapp_messages(
    tenant_id,appointment_id,user_id,phone_e164,event_kind,event_version,scheduled_at)
  VALUES (NEW.tenant_id,NEW.id,barber_record.user_id,assigned_phone,'barber_created',0,now())
  ON CONFLICT(tenant_id,appointment_id,event_kind,event_version) DO NOTHING;
  RETURN NEW;
END;
$$;

COMMIT;
