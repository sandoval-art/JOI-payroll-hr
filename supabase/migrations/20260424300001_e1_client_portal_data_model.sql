-- Feature E Phase 1 — Client portal data model
-- Schema-only phase: new 'client' role, SECURITY DEFINER helpers, scoped views, RLS.
-- No UI, no hooks. Test client seed happens separately post-migration via MCP.
--
-- Sections:
--   A. user_profiles schema changes (client_id column + CHECK constraints)
--   B. guard_user_profile_role trigger update (allow 'client' role changes)
--   C. SECURITY DEFINER helpers (is_client, my_client_id, my_client_campaign_ids)
--   D. employees_client_view
--   E. eod_logs_client_view
--   F. RLS policy updates (clients, campaigns, campaign_kpi_config)

-- ── A. user_profiles schema changes ──────────────────────────────────────────

-- Add nullable client_id FK (RESTRICT prevents orphan auth users if a client is deleted)
ALTER TABLE public.user_profiles
  ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE RESTRICT;

-- Drop existing role CHECK and replace with one that includes 'client'
ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_role_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('owner', 'admin', 'manager', 'team_lead', 'agent', 'employee', 'client'));

-- Invariant: client rows have client_id + no employee_id; non-client rows have no client_id.
-- Does NOT enforce employee_id IS NOT NULL for non-client roles — existing 'employee' role
-- and potential edge cases mean that check stays on the application layer.
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_client_invariant
  CHECK (
    (role = 'client' AND client_id IS NOT NULL AND employee_id IS NULL)
    OR
    (role <> 'client' AND client_id IS NULL)
  );

-- ── B. guard_user_profile_role trigger update ─────────────────────────────────
-- Original trigger blocks direct role changes unless employee_id also changed
-- (the sync-trigger detection heuristic). Client users have no employee record
-- so we must exempt changes where either old or new role is 'client'.

CREATE OR REPLACE FUNCTION public.guard_user_profile_role()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    -- Client users have no employee record; role is set directly by leadership.
    IF OLD.role = 'client' OR NEW.role = 'client' THEN
      RETURN NEW;
    END IF;
    -- For all employee-linked roles, role changes must flow through employees.title
    -- (the trg_sync_user_profile_role trigger changes both role and employee_id).
    IF OLD.employee_id IS NOT DISTINCT FROM NEW.employee_id THEN
      RAISE EXCEPTION 'Direct role changes are not allowed. Update employees.title instead.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ── C. SECURITY DEFINER helper functions ──────────────────────────────────────
-- Mirror the pattern of is_leadership() / is_team_lead() / my_tl_campaign_ids()
-- from 20260416000001_rls_hardening.sql, plus the explicit GRANT pattern from
-- tl_employee_on_my_team() in 20260423200001_fix_tl_rls_subqueries_after_a1_hardening.sql.
--
-- my_client_campaign_ids() is intentionally a SECURITY DEFINER helper rather than an inline
-- subquery in the views and RLS policies. Lesson from the TL RLS subquery bug
-- (20260423200001): direct subqueries against base tables silently return empty if upstream
-- RLS tightens. The SECURITY DEFINER function bypasses that.

CREATE OR REPLACE FUNCTION public.is_client()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role = 'client'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_client() TO authenticated;

CREATE OR REPLACE FUNCTION public.my_client_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT client_id FROM public.user_profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.my_client_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.my_client_campaign_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.campaigns WHERE client_id = public.my_client_id();
$$;

GRANT EXECUTE ON FUNCTION public.my_client_campaign_ids() TO authenticated;

-- ── D. employees_client_view ──────────────────────────────────────────────────
-- Pattern from employees_no_pay (20260421300001_a1b_expose_work_name.sql):
--   security_invoker = off  → view runs as owner, bypasses employees RLS
--   role-gated WHERE        → scoping enforced via SECURITY DEFINER helpers
--
-- Exposes: id, display_name (COALESCE work_name→full_name), campaign_id, title, is_active.
-- Excludes ALL sensitive fields: full_name (as raw column), work_name (raw), tax info,
-- salary, contact, DOB, NSS, address, bank details, hire_date, emergency_contact,
-- last_worked_day, department_id, compliance_grace_until, employee_id (JOI-XXXX), email.

CREATE VIEW public.employees_client_view
WITH (security_invoker = off) AS
SELECT
  e.id,
  COALESCE(NULLIF(e.work_name, ''), e.full_name) AS display_name,
  e.campaign_id,
  e.title,
  e.is_active
FROM public.employees e
WHERE
  e.campaign_id IN (SELECT public.my_client_campaign_ids())
  AND public.is_client();

COMMENT ON VIEW public.employees_client_view IS
  'Client-facing employee view. Projects display_name (work_name with full_name fallback '
  'via COALESCE), campaign_id, title, is_active. No raw full_name, no tax/pay/contact/'
  'personal fields. Scoped to campaigns belonging to the authenticated client via '
  'my_client_campaign_ids(). security_invoker=off so RLS on employees is bypassed; '
  'row-scoping is enforced in the WHERE clause.';

GRANT SELECT ON public.employees_client_view TO authenticated;

-- ── E. eod_logs_client_view ───────────────────────────────────────────────────
-- Exposes: id, employee_id, campaign_id, date, metrics.
-- Excludes: notes (free-text, may contain internal context), created_at (operational),
--           last_edited_at + edit_count (amend trail — locked design call #3).

CREATE VIEW public.eod_logs_client_view
WITH (security_invoker = off) AS
SELECT
  el.id,
  el.employee_id,
  el.campaign_id,
  el.date,
  el.metrics
FROM public.eod_logs el
WHERE
  el.campaign_id IN (SELECT public.my_client_campaign_ids())
  AND public.is_client();

COMMENT ON VIEW public.eod_logs_client_view IS
  'Client-facing EOD logs. Exposes productivity metrics only: id, employee_id, campaign_id, '
  'date, metrics. Hides notes, created_at, last_edited_at, edit_count per design call #3 '
  '(no audit trail exposed to clients). security_invoker=off; row-scoping via WHERE clause.';

COMMENT ON COLUMN public.eod_logs_client_view.metrics IS
  'Exposed raw because the EOD form-builder is the contract — metrics keys are by construction '
  'a subset of active campaign_kpi_config.field_name for the campaign. If non-KPI keys ever '
  'start landing in this jsonb (coaching notes, internal flags, debug data), this view must be '
  'changed to whitelist keys via a campaign_kpi_config join.';

GRANT SELECT ON public.eod_logs_client_view TO authenticated;

-- ── F. RLS policy updates ─────────────────────────────────────────────────────
-- Replace blanket USING (true) SELECT policies with client-scoped versions.
-- Non-client users retain full SELECT access (preserving current behavior).
-- Clients see only their own scope.

-- clients: client sees own row only
DROP POLICY "authenticated_select_clients" ON public.clients;
CREATE POLICY "authenticated_select_clients"
  ON public.clients FOR SELECT TO authenticated
  USING ((NOT public.is_client()) OR (id = public.my_client_id()));

-- campaigns: client sees campaigns belonging to their client only
DROP POLICY "authenticated_select_campaigns" ON public.campaigns;
CREATE POLICY "authenticated_select_campaigns"
  ON public.campaigns FOR SELECT TO authenticated
  USING ((NOT public.is_client()) OR (client_id = public.my_client_id()));

-- campaign_kpi_config: client sees KPI config for their campaigns only
DROP POLICY "authenticated_select_campaign_kpi_config" ON public.campaign_kpi_config;
CREATE POLICY "authenticated_select_campaign_kpi_config"
  ON public.campaign_kpi_config FOR SELECT TO authenticated
  USING (
    (NOT public.is_client())
    OR (campaign_id IN (SELECT public.my_client_campaign_ids()))
  );

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
