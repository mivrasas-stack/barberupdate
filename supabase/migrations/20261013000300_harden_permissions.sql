-- Protect customer PII from unrelated employees within the same tenant.
BEGIN;
DROP POLICY IF EXISTS appt_member_or_customer_select ON public.appointments;
CREATE POLICY appt_member_or_customer_select ON public.appointments
FOR SELECT TO authenticated
USING (
  customer_user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.tenant_members m
    WHERE m.tenant_id=appointments.tenant_id
      AND m.user_id=(SELECT auth.uid())
      AND m.role IN ('owner','manager')
  )
  OR EXISTS (
    SELECT 1 FROM public.tenant_members m
    JOIN public.barbers b ON b.tenant_id=m.tenant_id AND b.user_id=m.user_id
    WHERE m.tenant_id=appointments.tenant_id
      AND m.user_id=(SELECT auth.uid())
      AND m.role='barber'
      AND b.id=appointments.barber_id
  )
);
REVOKE ALL ON FUNCTION public.barberos_appt_outbox() FROM PUBLIC;
COMMIT;
