-- One-time reconciliation of *factory-default* barber shifts (Mon–Sat 09:00–18:00)
-- with the business's already-saved commercial hours.
-- Individually configured shifts and barbers without work intervals are untouched.
-- If there are upcoming bookings, leave that professional unchanged for manual review.
DO $migration$
DECLARE
  item record;
  day_num integer;
  open_min integer;
  close_min integer;
  saved_days text;
  actual_days integer[];
BEGIN
  FOR item IN
    SELECT t.id AS tenant_id,w.barber_id,t.opening_hours
    FROM public.tenants t
    JOIN public.barber_work_intervals w ON w.tenant_id=t.id
    WHERE t.status='active'
    GROUP BY t.id,w.barber_id,t.opening_hours
    HAVING count(*)=6
      AND bool_and(w.weekday BETWEEN 1 AND 6
                   AND w.start_minute=540 AND w.end_minute=1080)
  LOOP
    saved_days:=lower(translate(btrim(item.opening_hours->>'days'),'áéíóúÁÉÍÓÚ','aeiouAEIOU'));
    IF saved_days NOT IN ('lunes a sabado','miercoles a lunes') THEN
      RAISE NOTICE 'Unsupported legacy weekday label for tenant %: skip',item.tenant_id;
      CONTINUE;
    END IF;
    open_min:=split_part(item.opening_hours->>'open',':',1)::integer*60
              +split_part(item.opening_hours->>'open',':',2)::integer;
    close_min:=split_part(item.opening_hours->>'close',':',1)::integer*60
               +split_part(item.opening_hours->>'close',':',2)::integer;
    IF open_min<0 OR close_min>1440 OR open_min>=close_min THEN
      RAISE EXCEPTION 'Invalid business hours for tenant %',item.tenant_id;
    END IF;
    actual_days:=CASE WHEN saved_days='miercoles a lunes'
      THEN ARRAY[0,1,3,4,5,6] ELSE ARRAY[1,2,3,4,5,6] END;
    PERFORM pg_advisory_xact_lock(hashtextextended(item.tenant_id::text||':schedule:'||item.barber_id::text,0));
    -- Revalidate after the schedule lock. No other employee's custom shift is changed.
    IF (SELECT count(*) FROM public.barber_work_intervals w
        WHERE w.tenant_id=item.tenant_id AND w.barber_id=item.barber_id
          AND w.weekday BETWEEN 1 AND 6 AND w.start_minute=540 AND w.end_minute=1080)<>6
       OR (SELECT count(*) FROM public.barber_work_intervals w
           WHERE w.tenant_id=item.tenant_id AND w.barber_id=item.barber_id)<>6
       OR EXISTS(SELECT 1 FROM public.appointments a
                 WHERE a.tenant_id=item.tenant_id AND a.barber_id=item.barber_id
                   AND a.starts_at>now()
                   AND a.status IN ('pending','confirmed','waiting','in_service'))
    THEN
      RAISE NOTICE 'Customized schedule or future booking for barber %: skip',item.barber_id;
      CONTINUE;
    END IF;
    DELETE FROM public.barber_work_intervals
     WHERE tenant_id=item.tenant_id AND barber_id=item.barber_id;
    FOREACH day_num IN ARRAY actual_days LOOP
      INSERT INTO public.barber_work_intervals(tenant_id,barber_id,weekday,start_minute,end_minute)
      VALUES(item.tenant_id,item.barber_id,day_num,open_min,close_min);
    END LOOP;
  END LOOP;
END
$migration$;
