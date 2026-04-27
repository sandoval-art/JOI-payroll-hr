/**
 * Multi-tenancy Phase 2 — Add organization_id to clients, campaigns, employees
 *
 * Adds org scoping to the three root tables everything else hangs off.
 * Backfills all existing rows to the JOI org, then tightens to NOT NULL.
 * Replaces RLS policies on all three tables with org-filtered equivalents.
 * Rebuilds employees_no_pay view with org filter (security_invoker=off, so
 * the WHERE clause is the only security boundary for that view).
 *
 * Policy names confirmed from:
 *   - 20260416000001_rls_hardening.sql
 *   - 20260421100001_a1_harden_employees_rls.sql  (drops tl_select_team_employees)
 *   - 20260424300001_e1_client_portal_data_model.sql  (replaces authenticated_select_*)
 *
 * employees_no_pay columns from 20260421300001_a1b_expose_work_name.sql.
 *
 * Do NOT apply via supabase db push — apply manually via MCP SQL editor after review.
 */

-- ---------------------------------------------------------------------------
-- A. Add organization_id columns (nullable first — backfilled in section B)
-- ---------------------------------------------------------------------------
ALTER TABLE public.clients
  ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE public.campaigns
  ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE public.employees
  ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- B. Backfill all existing rows to the JOI org
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'joi';
  UPDATE public.clients   SET organization_id = v_org_id;
  UPDATE public.campaigns SET organization_id = v_org_id;
  UPDATE public.employees SET organization_id = v_org_id;
END $$;

-- ---------------------------------------------------------------------------
-- C. Tighten to NOT NULL now that every row has been backfilled
-- ---------------------------------------------------------------------------
ALTER TABLE public.clients    ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.campaigns  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.employees  ALTER COLUMN organization_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- D. RLS on clients
--    Current policies set by e1 migration (20260424300001):
--      authenticated_select_clients — replaced by e1 to add is_client() guard
--    Other three come from rls_hardening (20260416000001).
-- ---------------------------------------------------------------------------
DROP POLICY "authenticated_select_clients" ON public.clients;
DROP POLICY "leadership_write_clients"     ON public.clients;
DROP POLICY "leadership_update_clients"    ON public.clients;
DROP POLICY "leadership_delete_clients"    ON public.clients;

CREATE POLICY "authenticated_select_clients" ON public.clients
  FOR SELECT TO authenticated
  USING (
    organization_id = public.my_org_id()
    AND ((NOT public.is_client()) OR (id = public.my_client_id()))
  );

CREATE POLICY "leadership_write_clients" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.my_org_id() AND public.is_leadership());

CREATE POLICY "leadership_update_clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (organization_id = public.my_org_id() AND public.is_leadership());

CREATE POLICY "leadership_delete_clients" ON public.clients
  FOR DELETE TO authenticated
  USING (organization_id = public.my_org_id() AND public.is_leadership());

-- ---------------------------------------------------------------------------
-- E. RLS on campaigns
--    Same history as clients — authenticated_select replaced by e1.
-- ---------------------------------------------------------------------------
DROP POLICY "authenticated_select_campaigns" ON public.campaigns;
DROP POLICY "leadership_write_campaigns"     ON public.campaigns;
DROP POLICY "leadership_update_campaigns"    ON public.campaigns;
DROP POLICY "leadership_delete_campaigns"    ON public.campaigns;

CREATE POLICY "authenticated_select_campaigns" ON public.campaigns
  FOR SELECT TO authenticated
  USING (
    organization_id = public.my_org_id()
    AND ((NOT public.is_client()) OR (client_id = public.my_client_id()))
  );

CREATE POLICY "leadership_write_campaigns" ON public.campaigns
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.my_org_id() AND public.is_leadership());

CREATE POLICY "leadership_update_campaigns" ON public.campaigns
  FOR UPDATE TO authenticated
  USING (organization_id = public.my_org_id() AND public.is_leadership());

CREATE POLICY "leadership_delete_campaigns" ON public.campaigns
  FOR DELETE TO authenticated
  USING (organization_id = public.my_org_id() AND public.is_leadership());

-- ---------------------------------------------------------------------------
-- F. RLS on employees
--    Confirmed names from rls_hardening + a1_harden:
--      leadership_select_employees    — from rls_hardening, still active
--      agents_select_own_employee     — from rls_hardening (note: "agents", plural)
--      leadership_insert_employees    — from rls_hardening, still active
--      leadership_update_employees    — from rls_hardening, still active
--      leadership_delete_employees    — from rls_hardening, still active
--      tl_select_team_employees       — ALREADY DROPPED in a1_harden_employees_rls
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "leadership_select_employees" ON public.employees;
DROP POLICY IF EXISTS "agents_select_own_employee"  ON public.employees;
DROP POLICY IF EXISTS "leadership_insert_employees" ON public.employees;
DROP POLICY IF EXISTS "leadership_update_employees" ON public.employees;
DROP POLICY IF EXISTS "leadership_delete_employees" ON public.employees;

CREATE POLICY "leadership_select_employees" ON public.employees
  FOR SELECT TO authenticated
  USING (organization_id = public.my_org_id() AND public.is_leadership());

CREATE POLICY "agents_select_own_employee" ON public.employees
  FOR SELECT TO authenticated
  USING (organization_id = public.my_org_id() AND id = public.my_employee_id());

CREATE POLICY "leadership_insert_employees" ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.my_org_id() AND public.is_leadership());

CREATE POLICY "leadership_update_employees" ON public.employees
  FOR UPDATE TO authenticated
  USING (organization_id = public.my_org_id() AND public.is_leadership());

CREATE POLICY "leadership_delete_employees" ON public.employees
  FOR DELETE TO authenticated
  USING (organization_id = public.my_org_id() AND public.is_leadership());

-- ---------------------------------------------------------------------------
-- G. Rebuild employees_no_pay view with org filter
--    Columns from 20260421300001_a1b_expose_work_name.sql (latest definition):
--      id, employee_id, full_name, work_name, campaign_id, is_active,
--      created_at, title, reports_to, email
--    security_invoker=off means RLS on the base table is bypassed — the WHERE
--    clause here IS the sole security boundary for this view.
-- ---------------------------------------------------------------------------
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
  e.organization_id = public.my_org_id()
  AND (
    public.is_leadership()
    OR (
      public.is_team_lead()
      AND (
        e.campaign_id IN (SELECT public.my_tl_campaign_ids())
        OR e.id = public.my_employee_id()
      )
    )
    OR e.id = public.my_employee_id()
  );

COMMENT ON VIEW public.employees_no_pay IS
  'Employees without pay/tax columns. Row-scoped internally (security_invoker=off). '
  'Org-scoped via my_org_id(). '
  'Leadership -> all org rows, TL -> campaign team + self, Agent -> self only.';

GRANT SELECT ON public.employees_no_pay TO authenticated;

-- ---------------------------------------------------------------------------
-- H. Reload PostgREST schema cache
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
