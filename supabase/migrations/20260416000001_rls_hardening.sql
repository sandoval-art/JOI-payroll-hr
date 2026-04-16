-- ============================================================================
-- Migration: 20260416000001_rls_hardening
-- Purpose:   Replace blanket "allow all authenticated" RLS policies with
--            role-scoped policies matching the 5-tier permission model.
--
-- Background: docs/security/rls-audit-2026-04-16.md identified 13 of 15
-- tables with effectively no row-level security. This migration fixes all of
-- them in one pass.
--
-- Approach for C1 (user_profiles privilege escalation):
--   We use a CHECK trigger on user_profiles that prevents direct writes to
--   the role column. Only the existing sync_user_profile_role() trigger
--   (SECURITY DEFINER, fires on INSERT or UPDATE OF employee_id) may set
--   the role. This is simpler and more robust than splitting UPDATE policies
--   by column, because Postgres RLS cannot restrict which columns are
--   updated — only whether the row matches. A CHECK trigger fires after
--   the update and can compare OLD.role to NEW.role, rejecting unauthorized
--   changes cleanly.
--
-- Does NOT touch: shift_settings_audit, mexican_holidays (already correct).
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. HELPER: leadership check (avoids repeating the same subquery everywhere)
-- ============================================================================
-- Returns TRUE if the calling auth user is owner, admin, or manager.
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
      AND e.title IN ('owner', 'admin', 'manager')
  );
$$;

-- Returns TRUE if the calling auth user is a team_lead.
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
      AND e.title = 'team_lead'
  );
$$;

-- Returns the employees.id for the current auth user (NULL if not linked).
CREATE OR REPLACE FUNCTION public.my_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.employee_id
  FROM public.user_profiles up
  WHERE up.id = auth.uid();
$$;

-- Returns campaign IDs where the current user is team lead.
CREATE OR REPLACE FUNCTION public.my_tl_campaign_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.campaigns c
  WHERE c.team_lead_id = public.my_employee_id();
$$;

-- Returns employee IDs of team members who report to the current user.
CREATE OR REPLACE FUNCTION public.my_team_member_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id
  FROM public.employees e
  WHERE e.reports_to = public.my_employee_id();
$$;

-- ============================================================================
-- 1. DROP ALL EXISTING BLANKET POLICIES
-- ============================================================================

-- employees (two overlapping policies from different migrations)
DROP POLICY IF EXISTS "Allow full access to employees" ON public.employees;
DROP POLICY IF EXISTS "Allow full access for authenticated" ON public.employees;

-- payroll_periods
DROP POLICY IF EXISTS "Allow full access to payroll_periods" ON public.payroll_periods;
DROP POLICY IF EXISTS "Allow full access for authenticated" ON public.payroll_periods;

-- payroll_records
DROP POLICY IF EXISTS "Allow full access to payroll_records" ON public.payroll_records;
DROP POLICY IF EXISTS "Allow full access for authenticated" ON public.payroll_records;

-- clients
DROP POLICY IF EXISTS "Allow full access to clients" ON public.clients;
DROP POLICY IF EXISTS "Allow full access for authenticated" ON public.clients;

-- invoices
DROP POLICY IF EXISTS "Allow full access to invoices" ON public.invoices;
DROP POLICY IF EXISTS "Allow full access for authenticated" ON public.invoices;

-- invoice_lines
DROP POLICY IF EXISTS "Allow full access to invoice_lines" ON public.invoice_lines;
DROP POLICY IF EXISTS "Allow full access for authenticated" ON public.invoice_lines;

-- user_profiles
DROP POLICY IF EXISTS "Allow full access for authenticated" ON public.user_profiles;

-- time_clock
DROP POLICY IF EXISTS "Allow full access for authenticated" ON public.time_clock;

-- time_off_requests
DROP POLICY IF EXISTS "Allow full access for authenticated" ON public.time_off_requests;

-- eod_logs
DROP POLICY IF EXISTS "Allow full access for authenticated" ON public.eod_logs;

-- shift_settings
DROP POLICY IF EXISTS "Allow full access for authenticated" ON public.shift_settings;

-- campaign_kpi_config
DROP POLICY IF EXISTS "Allow full access for authenticated" ON public.campaign_kpi_config;

-- campaigns
DROP POLICY IF EXISTS "Allow full access for authenticated" ON public.campaigns;

-- ============================================================================
-- 2. user_profiles — FIX C1 (privilege escalation)
-- ============================================================================

-- Users can read their own profile
CREATE POLICY "users_read_own_profile"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Leadership can read all profiles (user management UI)
CREATE POLICY "leadership_read_all_profiles"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (public.is_leadership());

-- Users can insert their own profile on signup
CREATE POLICY "users_insert_own_profile"
  ON public.user_profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- No UPDATE/DELETE via RLS. Role changes go through employees.title → trigger.

-- Prevent direct role column changes via a trigger (defense in depth for C1).
-- The sync_user_profile_role trigger (SECURITY DEFINER) sets role on INSERT
-- and UPDATE OF employee_id. This guard rejects any other attempt to change role.
CREATE OR REPLACE FUNCTION public.guard_user_profile_role()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    -- Allow if this is happening inside the sync trigger context.
    -- We detect this by checking if employee_id also changed (the sync
    -- trigger fires on INSERT or UPDATE OF employee_id).
    IF OLD.employee_id IS NOT DISTINCT FROM NEW.employee_id THEN
      RAISE EXCEPTION 'Direct role changes are not allowed. Update employees.title instead.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_user_profile_role ON public.user_profiles;
CREATE TRIGGER trg_guard_user_profile_role
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_profile_role();

-- ============================================================================
-- 3. employees — FIX C2 (salary exposure)
-- ============================================================================

-- Leadership sees all employees
CREATE POLICY "leadership_select_employees"
  ON public.employees FOR SELECT TO authenticated
  USING (public.is_leadership());

-- Team leads see employees in their campaigns
CREATE POLICY "tl_select_team_employees"
  ON public.employees FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND campaign_id IN (SELECT public.my_tl_campaign_ids())
  );

-- Agents see only their own row
CREATE POLICY "agents_select_own_employee"
  ON public.employees FOR SELECT TO authenticated
  USING (id = public.my_employee_id());

-- Only leadership can INSERT/UPDATE/DELETE employees
CREATE POLICY "leadership_insert_employees"
  ON public.employees FOR INSERT TO authenticated
  WITH CHECK (public.is_leadership());

CREATE POLICY "leadership_update_employees"
  ON public.employees FOR UPDATE TO authenticated
  USING (public.is_leadership());

CREATE POLICY "leadership_delete_employees"
  ON public.employees FOR DELETE TO authenticated
  USING (public.is_leadership());

-- ============================================================================
-- 4. employees_no_pay VIEW (Q1 — salary isolation for team leads)
-- ============================================================================

-- security_invoker=on ensures the view runs with the CALLING user's
-- privileges, so the employees RLS policies above filter rows exactly
-- as they would for a direct table query. Without this, the view would
-- run as the view owner and bypass RLS entirely.
CREATE OR REPLACE VIEW public.employees_no_pay
WITH (security_invoker = on) AS
SELECT
  id,
  employee_id,
  full_name,
  campaign_id,
  is_active,
  created_at,
  title,
  reports_to,
  email
FROM public.employees;

COMMENT ON VIEW public.employees_no_pay IS
  'Employees without pay columns. Use for team-lead-facing queries that must not expose salary data.';

-- ============================================================================
-- 5. payroll_records — FIX C3 (payroll exposure)
-- ============================================================================

-- Leadership full access
CREATE POLICY "leadership_all_payroll_records"
  ON public.payroll_records FOR ALL TO authenticated
  USING (public.is_leadership())
  WITH CHECK (public.is_leadership());

-- Agents read own payroll only
CREATE POLICY "agents_select_own_payroll"
  ON public.payroll_records FOR SELECT TO authenticated
  USING (employee_id = public.my_employee_id());

-- ============================================================================
-- 6. invoice_lines — FIX C4 (billing rate exposure)
-- ============================================================================

CREATE POLICY "leadership_all_invoice_lines"
  ON public.invoice_lines FOR ALL TO authenticated
  USING (public.is_leadership())
  WITH CHECK (public.is_leadership());

-- ============================================================================
-- 7. invoices — FIX H4
-- ============================================================================

CREATE POLICY "leadership_all_invoices"
  ON public.invoices FOR ALL TO authenticated
  USING (public.is_leadership())
  WITH CHECK (public.is_leadership());

-- ============================================================================
-- 8. time_clock — FIX H1
-- ============================================================================

-- Leadership full access
CREATE POLICY "leadership_all_time_clock"
  ON public.time_clock FOR ALL TO authenticated
  USING (public.is_leadership())
  WITH CHECK (public.is_leadership());

-- Team leads: read their team's entries
CREATE POLICY "tl_select_team_time_clock"
  ON public.time_clock FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND employee_id IN (SELECT public.my_team_member_ids())
  );

-- Team leads: update their team's entries (Q4 — missed-clockout corrections)
CREATE POLICY "tl_update_team_time_clock"
  ON public.time_clock FOR UPDATE TO authenticated
  USING (
    public.is_team_lead()
    AND employee_id IN (SELECT public.my_team_member_ids())
  );

-- Agents: read own
CREATE POLICY "agents_select_own_time_clock"
  ON public.time_clock FOR SELECT TO authenticated
  USING (employee_id = public.my_employee_id());

-- Agents: insert own (clock in)
CREATE POLICY "agents_insert_own_time_clock"
  ON public.time_clock FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.my_employee_id());

-- Agents: update own (clock out, breaks)
CREATE POLICY "agents_update_own_time_clock"
  ON public.time_clock FOR UPDATE TO authenticated
  USING (employee_id = public.my_employee_id());

-- ============================================================================
-- 9. time_off_requests — FIX H2
-- ============================================================================

-- Leadership full access
CREATE POLICY "leadership_all_time_off"
  ON public.time_off_requests FOR ALL TO authenticated
  USING (public.is_leadership())
  WITH CHECK (public.is_leadership());

-- Team leads: read their team's requests
CREATE POLICY "tl_select_team_time_off"
  ON public.time_off_requests FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND employee_id IN (SELECT public.my_team_member_ids())
  );

-- Team leads: approve/deny their team's requests
CREATE POLICY "tl_update_team_time_off"
  ON public.time_off_requests FOR UPDATE TO authenticated
  USING (
    public.is_team_lead()
    AND employee_id IN (SELECT public.my_team_member_ids())
  );

-- Agents: read own requests
CREATE POLICY "agents_select_own_time_off"
  ON public.time_off_requests FOR SELECT TO authenticated
  USING (employee_id = public.my_employee_id());

-- Agents: submit new requests
CREATE POLICY "agents_insert_own_time_off"
  ON public.time_off_requests FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.my_employee_id());

-- ============================================================================
-- 10. eod_logs — FIX H3
-- ============================================================================

-- Leadership full access
CREATE POLICY "leadership_all_eod_logs"
  ON public.eod_logs FOR ALL TO authenticated
  USING (public.is_leadership())
  WITH CHECK (public.is_leadership());

-- Team leads: read their team's EOD
CREATE POLICY "tl_select_team_eod_logs"
  ON public.eod_logs FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND employee_id IN (SELECT public.my_team_member_ids())
  );

-- Team leads: update their team's EOD (Q5 — TLs may correct)
CREATE POLICY "tl_update_team_eod_logs"
  ON public.eod_logs FOR UPDATE TO authenticated
  USING (
    public.is_team_lead()
    AND employee_id IN (SELECT public.my_team_member_ids())
  );

-- Agents: read own EOD
CREATE POLICY "agents_select_own_eod_logs"
  ON public.eod_logs FOR SELECT TO authenticated
  USING (employee_id = public.my_employee_id());

-- Agents: insert own EOD (Q5 — insert only, no update)
CREATE POLICY "agents_insert_own_eod_logs"
  ON public.eod_logs FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.my_employee_id());

-- ============================================================================
-- 11. payroll_periods — FIX M1
-- ============================================================================

-- Everyone can read periods (just date ranges)
CREATE POLICY "authenticated_select_payroll_periods"
  ON public.payroll_periods FOR SELECT TO authenticated
  USING (true);

-- Only leadership can create/modify/delete periods
CREATE POLICY "leadership_insert_payroll_periods"
  ON public.payroll_periods FOR INSERT TO authenticated
  WITH CHECK (public.is_leadership());

CREATE POLICY "leadership_update_payroll_periods"
  ON public.payroll_periods FOR UPDATE TO authenticated
  USING (public.is_leadership());

CREATE POLICY "leadership_delete_payroll_periods"
  ON public.payroll_periods FOR DELETE TO authenticated
  USING (public.is_leadership());

-- ============================================================================
-- 12. clients — FIX M2 (Q2: everyone reads)
-- ============================================================================

CREATE POLICY "authenticated_select_clients"
  ON public.clients FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "leadership_write_clients"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.is_leadership());

CREATE POLICY "leadership_update_clients"
  ON public.clients FOR UPDATE TO authenticated
  USING (public.is_leadership());

CREATE POLICY "leadership_delete_clients"
  ON public.clients FOR DELETE TO authenticated
  USING (public.is_leadership());

-- ============================================================================
-- 13. campaigns — FIX M2 (Q2: everyone reads)
-- ============================================================================

CREATE POLICY "authenticated_select_campaigns"
  ON public.campaigns FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "leadership_write_campaigns"
  ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (public.is_leadership());

CREATE POLICY "leadership_update_campaigns"
  ON public.campaigns FOR UPDATE TO authenticated
  USING (public.is_leadership());

CREATE POLICY "leadership_delete_campaigns"
  ON public.campaigns FOR DELETE TO authenticated
  USING (public.is_leadership());

-- ============================================================================
-- 14. shift_settings — FIX M2 (TLs can edit own campaign per permission model)
-- ============================================================================

CREATE POLICY "authenticated_select_shift_settings"
  ON public.shift_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "leadership_write_shift_settings"
  ON public.shift_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_leadership());

CREATE POLICY "leadership_update_shift_settings"
  ON public.shift_settings FOR UPDATE TO authenticated
  USING (public.is_leadership());

CREATE POLICY "leadership_delete_shift_settings"
  ON public.shift_settings FOR DELETE TO authenticated
  USING (public.is_leadership());

-- Team leads: write to their own campaign's shift settings
CREATE POLICY "tl_insert_own_campaign_shifts"
  ON public.shift_settings FOR INSERT TO authenticated
  WITH CHECK (
    public.is_team_lead()
    AND campaign_id IN (SELECT public.my_tl_campaign_ids())
  );

CREATE POLICY "tl_update_own_campaign_shifts"
  ON public.shift_settings FOR UPDATE TO authenticated
  USING (
    public.is_team_lead()
    AND campaign_id IN (SELECT public.my_tl_campaign_ids())
  );

CREATE POLICY "tl_delete_own_campaign_shifts"
  ON public.shift_settings FOR DELETE TO authenticated
  USING (
    public.is_team_lead()
    AND campaign_id IN (SELECT public.my_tl_campaign_ids())
  );

-- ============================================================================
-- 15. campaign_kpi_config — FIX M2
-- ============================================================================

CREATE POLICY "authenticated_select_campaign_kpi_config"
  ON public.campaign_kpi_config FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "leadership_write_campaign_kpi_config"
  ON public.campaign_kpi_config FOR INSERT TO authenticated
  WITH CHECK (public.is_leadership());

CREATE POLICY "leadership_update_campaign_kpi_config"
  ON public.campaign_kpi_config FOR UPDATE TO authenticated
  USING (public.is_leadership());

CREATE POLICY "leadership_delete_campaign_kpi_config"
  ON public.campaign_kpi_config FOR DELETE TO authenticated
  USING (public.is_leadership());

-- ============================================================================
-- 16. REVOKE auto_clockout_overdue from client roles (Q3)
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.auto_clockout_overdue() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_clockout_overdue() FROM anon;

COMMIT;
