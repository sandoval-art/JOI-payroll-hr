-- ============================================================================
-- Rollback: 20260416000002_rls_hardening_rollback
-- Reverses 20260416000001_rls_hardening back to the previous blanket policies.
-- RUN THIS ONLY IF THE HARDENING MIGRATION BREAKS SOMETHING.
-- WARNING: This restores the insecure "all authenticated = full access" state.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. DROP all new policies
-- ============================================================================

-- user_profiles
DROP POLICY IF EXISTS "users_read_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "leadership_read_all_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "users_insert_own_profile" ON public.user_profiles;

-- employees
DROP POLICY IF EXISTS "leadership_select_employees" ON public.employees;
DROP POLICY IF EXISTS "tl_select_team_employees" ON public.employees;
DROP POLICY IF EXISTS "agents_select_own_employee" ON public.employees;
DROP POLICY IF EXISTS "leadership_insert_employees" ON public.employees;
DROP POLICY IF EXISTS "leadership_update_employees" ON public.employees;
DROP POLICY IF EXISTS "leadership_delete_employees" ON public.employees;

-- payroll_records
DROP POLICY IF EXISTS "leadership_all_payroll_records" ON public.payroll_records;
DROP POLICY IF EXISTS "agents_select_own_payroll" ON public.payroll_records;

-- invoice_lines
DROP POLICY IF EXISTS "leadership_all_invoice_lines" ON public.invoice_lines;

-- invoices
DROP POLICY IF EXISTS "leadership_all_invoices" ON public.invoices;

-- time_clock
DROP POLICY IF EXISTS "leadership_all_time_clock" ON public.time_clock;
DROP POLICY IF EXISTS "tl_select_team_time_clock" ON public.time_clock;
DROP POLICY IF EXISTS "tl_update_team_time_clock" ON public.time_clock;
DROP POLICY IF EXISTS "agents_select_own_time_clock" ON public.time_clock;
DROP POLICY IF EXISTS "agents_insert_own_time_clock" ON public.time_clock;
DROP POLICY IF EXISTS "agents_update_own_time_clock" ON public.time_clock;

-- time_off_requests
DROP POLICY IF EXISTS "leadership_all_time_off" ON public.time_off_requests;
DROP POLICY IF EXISTS "tl_select_team_time_off" ON public.time_off_requests;
DROP POLICY IF EXISTS "tl_update_team_time_off" ON public.time_off_requests;
DROP POLICY IF EXISTS "agents_select_own_time_off" ON public.time_off_requests;
DROP POLICY IF EXISTS "agents_insert_own_time_off" ON public.time_off_requests;

-- eod_logs
DROP POLICY IF EXISTS "leadership_all_eod_logs" ON public.eod_logs;
DROP POLICY IF EXISTS "tl_select_team_eod_logs" ON public.eod_logs;
DROP POLICY IF EXISTS "tl_update_team_eod_logs" ON public.eod_logs;
DROP POLICY IF EXISTS "agents_select_own_eod_logs" ON public.eod_logs;
DROP POLICY IF EXISTS "agents_insert_own_eod_logs" ON public.eod_logs;

-- payroll_periods
DROP POLICY IF EXISTS "authenticated_select_payroll_periods" ON public.payroll_periods;
DROP POLICY IF EXISTS "leadership_insert_payroll_periods" ON public.payroll_periods;
DROP POLICY IF EXISTS "leadership_update_payroll_periods" ON public.payroll_periods;
DROP POLICY IF EXISTS "leadership_delete_payroll_periods" ON public.payroll_periods;

-- clients
DROP POLICY IF EXISTS "authenticated_select_clients" ON public.clients;
DROP POLICY IF EXISTS "leadership_write_clients" ON public.clients;
DROP POLICY IF EXISTS "leadership_update_clients" ON public.clients;
DROP POLICY IF EXISTS "leadership_delete_clients" ON public.clients;

-- campaigns
DROP POLICY IF EXISTS "authenticated_select_campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "leadership_write_campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "leadership_update_campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "leadership_delete_campaigns" ON public.campaigns;

-- shift_settings
DROP POLICY IF EXISTS "authenticated_select_shift_settings" ON public.shift_settings;
DROP POLICY IF EXISTS "leadership_write_shift_settings" ON public.shift_settings;
DROP POLICY IF EXISTS "leadership_update_shift_settings" ON public.shift_settings;
DROP POLICY IF EXISTS "leadership_delete_shift_settings" ON public.shift_settings;
DROP POLICY IF EXISTS "tl_insert_own_campaign_shifts" ON public.shift_settings;
DROP POLICY IF EXISTS "tl_update_own_campaign_shifts" ON public.shift_settings;
DROP POLICY IF EXISTS "tl_delete_own_campaign_shifts" ON public.shift_settings;

-- campaign_kpi_config
DROP POLICY IF EXISTS "authenticated_select_campaign_kpi_config" ON public.campaign_kpi_config;
DROP POLICY IF EXISTS "leadership_write_campaign_kpi_config" ON public.campaign_kpi_config;
DROP POLICY IF EXISTS "leadership_update_campaign_kpi_config" ON public.campaign_kpi_config;
DROP POLICY IF EXISTS "leadership_delete_campaign_kpi_config" ON public.campaign_kpi_config;

-- ============================================================================
-- 2. DROP the role guard trigger
-- ============================================================================

DROP TRIGGER IF EXISTS trg_guard_user_profile_role ON public.user_profiles;
DROP FUNCTION IF EXISTS public.guard_user_profile_role();

-- ============================================================================
-- 3. DROP the employees_no_pay view
-- ============================================================================

DROP VIEW IF EXISTS public.employees_no_pay;

-- ============================================================================
-- 4. DROP helper functions
-- ============================================================================

DROP FUNCTION IF EXISTS public.my_team_member_ids();
DROP FUNCTION IF EXISTS public.my_tl_campaign_ids();
DROP FUNCTION IF EXISTS public.my_employee_id();
DROP FUNCTION IF EXISTS public.is_team_lead();
DROP FUNCTION IF EXISTS public.is_leadership();

-- ============================================================================
-- 5. RE-GRANT execute on auto_clockout_overdue
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.auto_clockout_overdue() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_clockout_overdue() TO anon;

-- ============================================================================
-- 6. RESTORE original blanket policies
-- ============================================================================

-- employees
CREATE POLICY "Allow full access for authenticated" ON public.employees
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- payroll_periods
CREATE POLICY "Allow full access for authenticated" ON public.payroll_periods
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- payroll_records
CREATE POLICY "Allow full access for authenticated" ON public.payroll_records
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- clients
CREATE POLICY "Allow full access for authenticated" ON public.clients
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- invoices
CREATE POLICY "Allow full access for authenticated" ON public.invoices
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- invoice_lines
CREATE POLICY "Allow full access for authenticated" ON public.invoice_lines
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- user_profiles
CREATE POLICY "Allow full access for authenticated" ON public.user_profiles
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- time_clock
CREATE POLICY "Allow full access for authenticated" ON public.time_clock
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- time_off_requests
CREATE POLICY "Allow full access for authenticated" ON public.time_off_requests
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- eod_logs
CREATE POLICY "Allow full access for authenticated" ON public.eod_logs
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- shift_settings
CREATE POLICY "Allow full access for authenticated" ON public.shift_settings
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- campaign_kpi_config
CREATE POLICY "Allow full access for authenticated" ON public.campaign_kpi_config
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- campaigns
CREATE POLICY "Allow full access for authenticated" ON public.campaigns
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

COMMIT;
