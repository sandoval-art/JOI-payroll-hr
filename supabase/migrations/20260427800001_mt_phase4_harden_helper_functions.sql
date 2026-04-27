/**
 * Multi-tenancy Phase 4 — Org-scope SECURITY DEFINER helper functions
 *
 * Phases 1–3b added organization_id to every table and updated all RLS
 * policies to call my_org_id().  The helper functions themselves, however,
 * still read from employees and campaigns without an org guard.  With a
 * single org this is harmless, but before a second org is onboarded these
 * functions could theoretically return rows from the wrong org if a future
 * bug ever allows a user_profiles.employee_id to point across orgs.
 *
 * Fix: add AND <table>.organization_id = public.my_org_id() to every
 * helper that touches a table that now carries an org column.
 *
 * Functions that do NOT need changes (read user_profiles by auth.uid()
 * only — inherently scoped to the calling user):
 *   my_org_id(), my_employee_id(), my_client_id(), is_client()
 *
 * Functions updated here:
 *   is_leadership()          — employees JOIN: add org guard
 *   is_team_lead()           — employees JOIN: add org guard
 *   my_tl_campaign_ids()     — campaigns WHERE: add org guard
 *   my_team_member_ids()     — employees WHERE: add org guard
 *   tl_employee_on_my_team() — employees WHERE: add org guard
 *   my_client_campaign_ids() — campaigns WHERE: add org guard
 *
 * All are CREATE OR REPLACE — no DROP required.
 * Do NOT apply via supabase db push — apply manually via MCP SQL editor.
 */

-- ---------------------------------------------------------------------------
-- 1. is_leadership()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_leadership()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    JOIN public.employees e ON up.employee_id = e.id
    WHERE up.id = auth.uid()
      AND e.organization_id = public.my_org_id()
      AND e.title IN ('owner', 'admin', 'manager')
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. is_team_lead()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_team_lead()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    JOIN public.employees e ON up.employee_id = e.id
    WHERE up.id = auth.uid()
      AND e.organization_id = public.my_org_id()
      AND e.title = 'team_lead'
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. my_tl_campaign_ids()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_tl_campaign_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.campaigns c
  WHERE c.team_lead_id = public.my_employee_id()
    AND c.organization_id = public.my_org_id();
$$;

-- ---------------------------------------------------------------------------
-- 4. my_team_member_ids()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_team_member_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id
  FROM public.employees e
  WHERE e.reports_to = public.my_employee_id()
    AND e.organization_id = public.my_org_id();
$$;

-- ---------------------------------------------------------------------------
-- 5. tl_employee_on_my_team(p_employee_id uuid)
--    Delegates campaign membership check to my_tl_campaign_ids() (already
--    org-scoped above) and adds a direct org guard on the employees row too.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tl_employee_on_my_team(p_employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.id = p_employee_id
      AND e.organization_id = public.my_org_id()
      AND e.campaign_id IN (SELECT public.my_tl_campaign_ids())
  );
$$;

-- ---------------------------------------------------------------------------
-- 6. my_client_campaign_ids()
--    Returns campaign IDs visible to the calling client user.
--    client_id match is already scoped to the calling user; org guard on
--    campaigns makes the filter explicit.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_client_campaign_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.campaigns
  WHERE client_id = public.my_client_id()
    AND organization_id = public.my_org_id();
$$;

-- ---------------------------------------------------------------------------
-- Reload PostgREST schema cache
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
