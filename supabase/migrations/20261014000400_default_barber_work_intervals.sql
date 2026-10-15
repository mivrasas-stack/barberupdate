-- Phase: default barber work intervals for seamless availability
CREATE OR REPLACE FUNCTION public.barberos_barber_default_schedule()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.barber_work_intervals
    WHERE tenant_id = NEW.tenant_id AND barber_id = NEW.id
  ) THEN
    INSERT INTO public.barber_work_intervals(tenant_id, barber_id, weekday, start_minute, end_minute)
    VALUES
      (NEW.tenant_id, NEW.id, 0, 540, 1140),
      (NEW.tenant_id, NEW.id, 1, 540, 1140),
      (NEW.tenant_id, NEW.id, 2, 540, 1140),
      (NEW.tenant_id, NEW.id, 3, 540, 1140),
      (NEW.tenant_id, NEW.id, 4, 540, 1140),
      (NEW.tenant_id, NEW.id, 5, 540, 1140),
      (NEW.tenant_id, NEW.id, 6, 540, 1140)
    ON CONFLICT (tenant_id, barber_id, weekday, start_minute) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.barberos_barber_default_schedule() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_barbers_default_schedule ON public.barbers;
CREATE TRIGGER trg_barbers_default_schedule
AFTER INSERT ON public.barbers
FOR EACH ROW EXECUTE FUNCTION public.barberos_barber_default_schedule();

-- Backfill query: active barbers with 0 intervals
INSERT INTO public.barber_work_intervals (tenant_id, barber_id, weekday, start_minute, end_minute)
SELECT b.tenant_id, b.id, d.w, 540, 1140
FROM public.barbers b
CROSS JOIN (VALUES (0),(1),(2),(3),(4),(5),(6)) AS d(w)
WHERE b.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.barber_work_intervals w
    WHERE w.tenant_id = b.tenant_id AND w.barber_id = b.id
  )
ON CONFLICT (tenant_id, barber_id, weekday, start_minute) DO NOTHING;
