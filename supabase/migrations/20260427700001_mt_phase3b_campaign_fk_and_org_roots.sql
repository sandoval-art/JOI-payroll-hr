/**
 * Multi-tenancy Phase 3b — Campaign-FK table RLS + org-root table columns
 *
 * PART 1: RLS-only updates on campaign/client-FK tables (no column changes).
 *   Adds campaign_id/client_id subquery to leadership and TL policies.
 *   Agent policies are implicitly scoped and untouched.
 *
 * PART 2: Tables with no FK chain to employees/campaigns/clients — add
 *   organization_id directly (nullable → backfill → NOT NULL) and rebuild RLS.
 *
 * Policy text verified from:
 *   20260416000001_rls_hardening.sql          — shift_settings, campaign_kpi_config,
 *                                               payroll_periods, invoices, invoice_lines
 *   20260416000003_eod_digest_foundation.sql  — campaign_eod_recipients, campaign_eod_tl_notes
 *   20260417000001_eod_digest_sending_infra.sql — eod_digest_log
 *   20260420600001_c1_policy_catalog.sql       — policy_documents (complex SELECT policy)
 *   20260421200001_a1b_expanded_employee_record.sql — departments
 *   20260424300001_e1_client_portal_data_model.sql  — campaign_kpi_config SELECT (has is_client guard)
 *   20260425100001_d1_holiday_data_model.sql   — company_holidays
 *
 * Do NOT apply via supabase db push — apply manually via MCP SQL editor after review.
 */

-- ===========================================================================
-- PART 1: Campaign-FK tables (RLS-only, no schema changes)
-- ===========================================================================
-- Org filter used throughout Part 1:
--   campaign_id IN (SELECT id FROM public.campaigns WHERE organization_id = public.my_org_id())

-- ===========================================================================
-- 1. eod_digest_log (campaign_id FK)
--    Agents have no policies on this table.
-- ===========================================================================
DROP POLICY IF EXISTS "leadership_all_eod_digest_log"            ON public.eod_digest_log;
DROP POLICY IF EXISTS "tl_select_own_campaign_eod_digest_log"    ON public.eod_digest_log;

CREATE POLICY "leadership_all_eod_digest_log"
  ON public.eod_digest_log FOR ALL TO authenticated
  USING (
    public.is_leadership()
    AND campaign_id IN (SELECT id FROM public.campaigns WHERE organization_id = public.my_org_id())
  )
  WITH CHECK (
    public.is_leadership()
    AND campaign_id IN (SELECT id FROM public.campaigns WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_select_own_campaign_eod_digest_log"
  ON public.eod_digest_log FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND campaign_id IN (SELECT public.my_tl_campaign_ids())
    AND campaign_id IN (SELECT id FROM public.campaigns WHERE organization_id = public.my_org_id())
  );

-- ===========================================================================
-- 2. shift_settings (campaign_id FK)
--    authenticated_select was USING (true) — now org-scoped via campaign subquery.
-- ===========================================================================
DROP POLICY IF EXISTS "authenticated_select_shift_settings"  ON public.shift_settings;
DROP POLICY IF EXISTS "leadership_write_shift_settings"      ON public.shift_settings;
DROP POLICY IF EXISTS "leadership_update_shift_settings"     ON public.shift_settings;
DROP POLICY IF EXISTS "leadership_delete_shift_settings"     ON public.shift_settings;
DROP POLICY IF EXISTS "tl_insert_own_campaign_shifts"        ON public.shift_settings;
DROP POLICY IF EXISTS "tl_update_own_campaign_shifts"        ON public.shift_settings;
DROP POLICY IF EXISTS "tl_delete_own_campaign_shifts"        ON public.shift_settings;

CREATE POLICY "authenticated_select_shift_settings"
  ON public.shift_settings FOR SELECT TO authenticated
  USING (
    campaign_id IN (SELECT id FROM public.campaigns WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "leadership_write_shift_settings"
  ON public.shift_settings FOR INSERT TO authenticated
  WITH CHECK (
    public.is_leadership()
    AND campaign_id IN (SELECT id FROM public.campaigns WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "leadership_update_shift_settings"
  ON public.shift_settings FOR UPDATE TO authenticated
  USING (
    public.is_leadership()
    AND campaign_id IN (SELECT id FROM public.campaigns WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "leadership_delete_shift_settings"
  ON public.shift_settings FOR DELETE TO authenticated
  USING (
    public.is_leadership()
    AND campaign_id IN (SELECT id FROM public.campaigns WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_insert_own_campaign_shifts"
  ON public.shift_settings FOR INSERT TO authenticated
  WITH CHECK (
    public.is_team_lead()
    AND campaign_id IN (SELECT public.my_tl_campaign_ids())
    AND campaign_id IN (SELECT id FROM public.campaigns WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_update_own_campaign_shifts"
  ON public.shift_settings FOR UPDATE TO authenticated
  USING (
    public.is_team_lead()
    AND campaign_id IN (SELECT public.my_tl_campaign_ids())
    AND campaign_id IN (SELECT id FROM public.campaigns WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_delete_own_campaign_shifts"
  ON public.shift_settings FOR DELETE TO authenticated
  USING (
    public.is_team_lead()
    AND campaign_id IN (SELECT public.my_tl_campaign_ids())
    AND campaign_id IN (SELECT id FROM public.campaigns WHERE organization_id = public.my_org_id())
  );

-- ===========================================================================
-- 3. campaign_kpi_config (campaign_id FK)
--    authenticated_select was last rewritten in e1 (20260424300001) to add an
--    is_client() guard — preserve that guard, add org filter alongside it.
-- ===========================================================================
DROP POLICY IF EXISTS "authenticated_select_campaign_kpi_config" ON public.campaign_kpi_config;
DROP POLICY IF EXISTS "leadership_write_campaign_kpi_config"     ON public.campaign_kpi_config;
DROP POLICY IF EXISTS "leadership_update_campaign_kpi_config"    ON public.campaign_kpi_config;
DROP POLICY IF EXISTS "leadership_delete_campaign_kpi_config"    ON public.campaign_kpi_config;

CREATE POLICY "authenticated_select_campaign_kpi_config"
  ON public.campaign_kpi_config FOR SELECT TO authenticated
  USING (
    campaign_id IN (SELECT id FROM public.campaigns WHERE organization_id = public.my_org_id())
    AND (
      (NOT public.is_client())
      OR (campaign_id IN (SELECT public.my_client_campaign_ids()))
    )
  );

CREATE POLICY "leadership_write_campaign_kpi_config"
  ON public.campaign_kpi_config FOR INSERT TO authenticated
  WITH CHECK (
    public.is_leadership()
    AND campaign_id IN (SELECT id FROM public.campaigns WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "leadership_update_campaign_kpi_config"
  ON public.campaign_kpi_config FOR UPDATE TO authenticated
  USING (
    public.is_leadership()
    AND campaign_id IN (SELECT id FROM public.campaigns WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "leadership_delete_campaign_kpi_config"
  ON public.campaign_kpi_config FOR DELETE TO authenticated
  USING (
    public.is_leadership()
    AND campaign_id IN (SELECT id FROM public.campaigns WHERE organization_id = public.my_org_id())
  );

-- ===========================================================================
-- 4. campaign_eod_recipients (campaign_id FK)
-- ===========================================================================
DROP POLICY IF EXISTS "leadership_all_eod_recipients"              ON public.campaign_eod_recipients;
DROP POLICY IF EXISTS "tl_select_own_campaign_eod_recipients"      ON public.campaign_eod_recipients;
DROP POLICY IF EXISTS "tl_insert_own_campaign_eod_recipients"      ON public.campaign_eod_recipients;
DROP POLICY IF EXISTS "tl_update_own_campaign_eod_recipients"      ON public.campaign_eod_recipients;
DROP POLICY IF EXISTS "tl_delete_own_campaign_eod_recipients"      ON public.campaign_eod_recipients;

CREATE POLICY "leadership_all_eod_recipients"
  ON public.campaign_eod_recipients FOR ALL TO authenticated
  USING (
    public.is_leadership()
    AND campaign_id IN (SELECT id FROM public.campaigns WHERE organization_id = public.my_org_id())
  )
  WITH CHECK (
    public.is_leadership()
    AND campaign_id IN (SELECT id FROM public.campaigns WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_select_own_campaign_eod_recipients"
  ON public.campaign_eod_recipients FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND campaign_id IN (SELECT public.my_tl_campaign_ids())
    AND campaign_id IN (SELECT id FROM public.campaigns WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_insert_own_campaign_eod_recipients"
  ON public.campaign_eod_recipients FOR INSERT TO authenticated
  WITH CHECK (
    public.is_team_lead()
    AND campaign_id IN (SELECT public.my_tl_campaign_ids())
    AND campaign_id IN (SELECT id FROM public.campaigns WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_update_own_campaign_eod_recipients"
  ON public.campaign_eod_recipients FOR UPDATE TO authenticated
  USING (
    public.is_team_lead()
    AND campaign_id IN (SELECT public.my_tl_campaign_ids())
    AND campaign_id IN (SELECT id FROM public.campaigns WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_delete_own_campaign_eod_recipients"
  ON public.campaign_eod_recipients FOR DELETE TO authenticated
  USING (
    public.is_team_lead()
    AND campaign_id IN (SELECT public.my_tl_campaign_ids())
    AND campaign_id IN (SELECT id FROM public.campaigns WHERE organization_id = public.my_org_id())
  );

-- ===========================================================================
-- 5. campaign_eod_tl_notes (campaign_id FK)
-- ===========================================================================
DROP POLICY IF EXISTS "leadership_all_eod_tl_notes"              ON public.campaign_eod_tl_notes;
DROP POLICY IF EXISTS "tl_select_own_campaign_eod_tl_notes"      ON public.campaign_eod_tl_notes;
DROP POLICY IF EXISTS "tl_insert_own_campaign_eod_tl_notes"      ON public.campaign_eod_tl_notes;
DROP POLICY IF EXISTS "tl_update_own_campaign_eod_tl_notes"      ON public.campaign_eod_tl_notes;

CREATE POLICY "leadership_all_eod_tl_notes"
  ON public.campaign_eod_tl_notes FOR ALL TO authenticated
  USING (
    public.is_leadership()
    AND campaign_id IN (SELECT id FROM public.campaigns WHERE organization_id = public.my_org_id())
  )
  WITH CHECK (
    public.is_leadership()
    AND campaign_id IN (SELECT id FROM public.campaigns WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_select_own_campaign_eod_tl_notes"
  ON public.campaign_eod_tl_notes FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND campaign_id IN (SELECT public.my_tl_campaign_ids())
    AND campaign_id IN (SELECT id FROM public.campaigns WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_insert_own_campaign_eod_tl_notes"
  ON public.campaign_eod_tl_notes FOR INSERT TO authenticated
  WITH CHECK (
    public.is_team_lead()
    AND campaign_id IN (SELECT public.my_tl_campaign_ids())
    AND campaign_id IN (SELECT id FROM public.campaigns WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_update_own_campaign_eod_tl_notes"
  ON public.campaign_eod_tl_notes FOR UPDATE TO authenticated
  USING (
    public.is_team_lead()
    AND campaign_id IN (SELECT public.my_tl_campaign_ids())
    AND campaign_id IN (SELECT id FROM public.campaigns WHERE organization_id = public.my_org_id())
  );

-- ===========================================================================
-- 6. invoices (client_id FK)
-- ===========================================================================
DROP POLICY IF EXISTS "leadership_all_invoices" ON public.invoices;

CREATE POLICY "leadership_all_invoices"
  ON public.invoices FOR ALL TO authenticated
  USING (
    public.is_leadership()
    AND client_id IN (SELECT id FROM public.clients WHERE organization_id = public.my_org_id())
  )
  WITH CHECK (
    public.is_leadership()
    AND client_id IN (SELECT id FROM public.clients WHERE organization_id = public.my_org_id())
  );

-- ===========================================================================
-- 7. invoice_lines (invoice_id → invoices → client_id → clients)
-- ===========================================================================
DROP POLICY IF EXISTS "leadership_all_invoice_lines" ON public.invoice_lines;

CREATE POLICY "leadership_all_invoice_lines"
  ON public.invoice_lines FOR ALL TO authenticated
  USING (
    public.is_leadership()
    AND invoice_id IN (
      SELECT id FROM public.invoices
      WHERE client_id IN (
        SELECT id FROM public.clients WHERE organization_id = public.my_org_id()
      )
    )
  )
  WITH CHECK (
    public.is_leadership()
    AND invoice_id IN (
      SELECT id FROM public.invoices
      WHERE client_id IN (
        SELECT id FROM public.clients WHERE organization_id = public.my_org_id()
      )
    )
  );

-- ===========================================================================
-- PART 2: Org-root tables — add organization_id column directly
-- ===========================================================================

-- ===========================================================================
-- 8. payroll_periods
-- ===========================================================================
ALTER TABLE public.payroll_periods
  ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;

DO $$
DECLARE v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'joi';
  UPDATE public.payroll_periods SET organization_id = v_org_id;
END $$;

ALTER TABLE public.payroll_periods ALTER COLUMN organization_id SET NOT NULL;

DROP POLICY IF EXISTS "authenticated_select_payroll_periods" ON public.payroll_periods;
DROP POLICY IF EXISTS "leadership_insert_payroll_periods"    ON public.payroll_periods;
DROP POLICY IF EXISTS "leadership_update_payroll_periods"    ON public.payroll_periods;
DROP POLICY IF EXISTS "leadership_delete_payroll_periods"    ON public.payroll_periods;

CREATE POLICY "authenticated_select_payroll_periods"
  ON public.payroll_periods FOR SELECT TO authenticated
  USING (organization_id = public.my_org_id());

CREATE POLICY "leadership_insert_payroll_periods"
  ON public.payroll_periods FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.my_org_id() AND public.is_leadership());

CREATE POLICY "leadership_update_payroll_periods"
  ON public.payroll_periods FOR UPDATE TO authenticated
  USING (organization_id = public.my_org_id() AND public.is_leadership());

CREATE POLICY "leadership_delete_payroll_periods"
  ON public.payroll_periods FOR DELETE TO authenticated
  USING (organization_id = public.my_org_id() AND public.is_leadership());

-- ===========================================================================
-- 9. departments
-- ===========================================================================
ALTER TABLE public.departments
  ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;

DO $$
DECLARE v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'joi';
  UPDATE public.departments SET organization_id = v_org_id;
END $$;

ALTER TABLE public.departments ALTER COLUMN organization_id SET NOT NULL;

DROP POLICY IF EXISTS "authenticated_select_departments" ON public.departments;
DROP POLICY IF EXISTS "leadership_all_departments"       ON public.departments;

CREATE POLICY "authenticated_select_departments"
  ON public.departments FOR SELECT TO authenticated
  USING (organization_id = public.my_org_id());

CREATE POLICY "leadership_all_departments"
  ON public.departments FOR ALL TO authenticated
  USING (organization_id = public.my_org_id() AND public.is_leadership())
  WITH CHECK (organization_id = public.my_org_id() AND public.is_leadership());

-- ===========================================================================
-- 10. policy_documents
--     authenticated_select_policies_for_me is complex — preserving the full
--     existing USING clause and adding AND organization_id = my_org_id().
--     Verified from 20260420600001_c1_policy_catalog.sql.
-- ===========================================================================
ALTER TABLE public.policy_documents
  ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;

DO $$
DECLARE v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'joi';
  UPDATE public.policy_documents SET organization_id = v_org_id;
END $$;

ALTER TABLE public.policy_documents ALTER COLUMN organization_id SET NOT NULL;

DROP POLICY IF EXISTS "leadership_all_policies"                ON public.policy_documents;
DROP POLICY IF EXISTS "authenticated_select_policies_for_me"   ON public.policy_documents;

CREATE POLICY "leadership_all_policies"
  ON public.policy_documents FOR ALL TO authenticated
  USING (organization_id = public.my_org_id() AND public.is_leadership())
  WITH CHECK (organization_id = public.my_org_id() AND public.is_leadership());

CREATE POLICY "authenticated_select_policies_for_me"
  ON public.policy_documents FOR SELECT TO authenticated
  USING (
    organization_id = public.my_org_id()
    AND is_active = true
    AND (
      is_global = true
      OR EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.id = public.my_employee_id()
          AND e.campaign_id = ANY(scoped_campaign_ids)
      )
    )
    AND (
      applicable_roles IS NULL
      OR EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.id = public.my_employee_id()
          AND e.title = ANY(applicable_roles)
      )
    )
  );

-- ===========================================================================
-- 11. company_holidays
--     Original read policy used auth.role() = 'authenticated' — preserved.
-- ===========================================================================
ALTER TABLE public.company_holidays
  ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;

DO $$
DECLARE v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'joi';
  UPDATE public.company_holidays SET organization_id = v_org_id;
END $$;

ALTER TABLE public.company_holidays ALTER COLUMN organization_id SET NOT NULL;

DROP POLICY IF EXISTS "company_holidays_read"              ON public.company_holidays;
DROP POLICY IF EXISTS "company_holidays_leadership_write"  ON public.company_holidays;

CREATE POLICY "company_holidays_read"
  ON public.company_holidays FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND organization_id = public.my_org_id()
  );

CREATE POLICY "company_holidays_leadership_write"
  ON public.company_holidays FOR ALL
  USING (organization_id = public.my_org_id() AND public.is_leadership())
  WITH CHECK (organization_id = public.my_org_id() AND public.is_leadership());

-- ===========================================================================
-- Reload PostgREST schema cache
-- ===========================================================================
NOTIFY pgrst, 'reload schema';
