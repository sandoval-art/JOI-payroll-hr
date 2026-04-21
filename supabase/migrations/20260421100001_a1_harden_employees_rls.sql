-- A1: Harden RLS on employees — remove TL direct SELECT on base table
-- TLs now read team data exclusively through the employees_no_pay view.
-- The view runs as SECURITY DEFINER (security_invoker=off) with row-scoping
-- baked into the WHERE clause, so RLS on the base table is bypassed safely.

BEGIN;

-- ── 1. Recreate employees_no_pay as security_invoker=off with row scoping ──
-- We must DROP + CREATE because ALTER VIEW … SET (security_invoker) is not
-- supported on all PG versions, and CREATE OR REPLACE cannot change view options.

DROP VIEW IF EXISTS public.employees_no_pay;

CREATE VIEW public.employees_no_pay
WITH (security_invoker = off) AS
SELECT
  e.id,
  e.employee_id,
  e.full_name,
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
  'Leadership → all rows, TL → campaign team + self, Agent → self only.';

-- ── 2. Grant SELECT to authenticated role ──────────────────────────────
GRANT SELECT ON public.employees_no_pay TO authenticated;

-- ── 3. Drop TL direct SELECT on base table ─────────────────────────────
-- Leadership and agent-self policies remain unchanged.
DROP POLICY IF EXISTS "tl_select_team_employees" ON public.employees;

COMMIT;
