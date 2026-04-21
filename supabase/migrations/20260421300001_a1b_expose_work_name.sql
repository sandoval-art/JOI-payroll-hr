-- A1b display layer: add work_name to employees_no_pay view.
-- work_name is not sensitive — it's a public display name (nickname / preferred name).
-- TLs need it to show roster names correctly.

BEGIN;

DROP VIEW IF EXISTS public.employees_no_pay;

CREATE VIEW public.employees_no_pay
WITH (security_invoker = off) AS
SELECT
  e.id,
  e.employee_id,
  e.full_name,
  e.work_name,
  e.campaign_id,
  e.is_active,
  e.created_at,
  e.title,
  e.reports_to,
  e.email
FROM public.employees e
WHERE
  -- Leadership sees every row
  public.is_leadership()
  OR (
    -- Team Lead sees their campaign members + their own row
    public.is_team_lead()
    AND (
      e.campaign_id IN (SELECT public.my_tl_campaign_ids())
      OR e.id = public.my_employee_id()
    )
  )
  -- Any authenticated user sees their own row
  OR e.id = public.my_employee_id();

COMMENT ON VIEW public.employees_no_pay IS
  'Employees without pay/tax columns. Row-scoped internally (security_invoker=off). '
  'Leadership -> all rows, TL -> campaign team + self, Agent -> self only.';

GRANT SELECT ON public.employees_no_pay TO authenticated;

COMMIT;
