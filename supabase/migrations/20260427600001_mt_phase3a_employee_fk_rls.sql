/**
 * Multi-tenancy Phase 3a — Org-scope RLS on employee-FK leaf tables
 *
 * Adds organization_id scoping to leadership and TL policies on all 15 leaf
 * tables that have a direct FK to employees. Agent policies that gate on
 * my_employee_id() are already implicitly org-scoped and are left alone.
 *
 * Approach:
 *   Leadership policies: add
 *     AND employee_id IN (SELECT id FROM public.employees
 *                         WHERE organization_id = public.my_org_id())
 *   TL policies (any variant): add the same subquery as extra guard.
 *   agent_coaching_notes uses agent_id (not employee_id) — subquery uses agent_id.
 *
 * Policy state verified against:
 *   20260416000001_rls_hardening.sql           — time_clock, time_off, eod_logs,
 *                                                payroll_records, coaching_notes (base)
 *   20260419000003_agent_coaching_notes.sql    — coaching_notes initial policies
 *   20260420200001_b1_notes_verbal_warnings.sql — drops tl_update/delete coaching (immutable)
 *   20260420300001_tl_select_team_documents.sql — employee_documents TL (precursor)
 *   20260420500001_b4_attendance_incidents.sql  — attendance_incidents base
 *   20260420600001_c1_policy_catalog.sql        — policy_acknowledgments
 *   20260422100001_b2b3_phase1_data_model.sql   — hr_document_requests, cartas, actas
 *   20260423100001_f1_resignation_packet.sql    — resignation_packets
 *   20260423200001_fix_tl_rls_subqueries.sql    — rewrites TL to tl_employee_on_my_team()
 *                                                for B2/B3/F/attendance/employee_documents
 *   20260425100001_d1_holiday_data_model.sql    — holiday_requests
 *   20260427100001_g1_vacation_data_model.sql   — vacation_requests
 *
 * NOTE: time_clock, time_off_requests, and eod_logs TL policies were NOT
 * rewritten by the 2026-04-23 fix — they still use my_team_member_ids().
 *
 * NOTE: tl_update_coaching_notes and tl_delete_coaching_notes were permanently
 * dropped in b1 for legal immutability — they must NOT be recreated here.
 *
 * Do NOT apply via supabase db push — apply manually via MCP SQL editor after review.
 */

-- ===========================================================================
-- 1. time_clock
-- ===========================================================================
DROP POLICY IF EXISTS "leadership_all_time_clock"   ON public.time_clock;
DROP POLICY IF EXISTS "tl_select_team_time_clock"   ON public.time_clock;
DROP POLICY IF EXISTS "tl_update_team_time_clock"   ON public.time_clock;

CREATE POLICY "leadership_all_time_clock"
  ON public.time_clock FOR ALL TO authenticated
  USING (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  )
  WITH CHECK (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_select_team_time_clock"
  ON public.time_clock FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND employee_id IN (SELECT public.my_team_member_ids())
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_update_team_time_clock"
  ON public.time_clock FOR UPDATE TO authenticated
  USING (
    public.is_team_lead()
    AND employee_id IN (SELECT public.my_team_member_ids())
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

-- ===========================================================================
-- 2. time_off_requests
-- ===========================================================================
DROP POLICY IF EXISTS "leadership_all_time_off"   ON public.time_off_requests;
DROP POLICY IF EXISTS "tl_select_team_time_off"   ON public.time_off_requests;
DROP POLICY IF EXISTS "tl_update_team_time_off"   ON public.time_off_requests;

CREATE POLICY "leadership_all_time_off"
  ON public.time_off_requests FOR ALL TO authenticated
  USING (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  )
  WITH CHECK (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_select_team_time_off"
  ON public.time_off_requests FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND employee_id IN (SELECT public.my_team_member_ids())
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_update_team_time_off"
  ON public.time_off_requests FOR UPDATE TO authenticated
  USING (
    public.is_team_lead()
    AND employee_id IN (SELECT public.my_team_member_ids())
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

-- ===========================================================================
-- 3. payroll_records
-- ===========================================================================
DROP POLICY IF EXISTS "leadership_all_payroll_records" ON public.payroll_records;

CREATE POLICY "leadership_all_payroll_records"
  ON public.payroll_records FOR ALL TO authenticated
  USING (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  )
  WITH CHECK (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

-- ===========================================================================
-- 4. agent_coaching_notes
--    FK column: agent_id (not employee_id)
--    tl_update_coaching_notes and tl_delete_coaching_notes were permanently
--    dropped in b1 (20260420200001) for legal immutability — NOT recreated.
-- ===========================================================================
DROP POLICY IF EXISTS "leadership_all_coaching_notes" ON public.agent_coaching_notes;
DROP POLICY IF EXISTS "tl_select_coaching_notes"      ON public.agent_coaching_notes;
DROP POLICY IF EXISTS "tl_insert_coaching_notes"      ON public.agent_coaching_notes;
-- These two were already dropped in b1; IF EXISTS prevents errors on re-run:
DROP POLICY IF EXISTS "tl_update_coaching_notes"      ON public.agent_coaching_notes;
DROP POLICY IF EXISTS "tl_delete_coaching_notes"      ON public.agent_coaching_notes;

CREATE POLICY "leadership_all_coaching_notes"
  ON public.agent_coaching_notes FOR ALL TO authenticated
  USING (
    public.is_leadership()
    AND agent_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  )
  WITH CHECK (
    public.is_leadership()
    AND agent_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_select_coaching_notes"
  ON public.agent_coaching_notes FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND campaign_id IN (SELECT public.my_tl_campaign_ids())
    AND agent_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_insert_coaching_notes"
  ON public.agent_coaching_notes FOR INSERT TO authenticated
  WITH CHECK (
    public.is_team_lead()
    AND campaign_id IN (SELECT public.my_tl_campaign_ids())
    AND agent_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

-- ===========================================================================
-- 5. attendance_incidents
--    TL policies use tl_employee_on_my_team() (rewritten 2026-04-23).
-- ===========================================================================
DROP POLICY IF EXISTS "leadership_all_attendance_incidents" ON public.attendance_incidents;
DROP POLICY IF EXISTS "tl_select_team_incidents"            ON public.attendance_incidents;
DROP POLICY IF EXISTS "tl_insert_team_incidents"            ON public.attendance_incidents;
DROP POLICY IF EXISTS "tl_update_team_incidents"            ON public.attendance_incidents;

CREATE POLICY "leadership_all_attendance_incidents"
  ON public.attendance_incidents FOR ALL TO authenticated
  USING (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  )
  WITH CHECK (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_select_team_incidents"
  ON public.attendance_incidents FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND public.tl_employee_on_my_team(employee_id)
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_insert_team_incidents"
  ON public.attendance_incidents FOR INSERT TO authenticated
  WITH CHECK (
    public.is_team_lead()
    AND public.tl_employee_on_my_team(employee_id)
    AND created_by = public.my_employee_id()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_update_team_incidents"
  ON public.attendance_incidents FOR UPDATE TO authenticated
  USING (
    public.is_team_lead()
    AND public.tl_employee_on_my_team(employee_id)
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  )
  WITH CHECK (
    public.is_team_lead()
    AND public.tl_employee_on_my_team(employee_id)
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

-- ===========================================================================
-- 6. employee_documents
--    TL policy uses tl_employee_on_my_team() (rewritten 2026-04-23).
-- ===========================================================================
DROP POLICY IF EXISTS "leadership_select_all_documents" ON public.employee_documents;
DROP POLICY IF EXISTS "leadership_insert_documents"     ON public.employee_documents;
DROP POLICY IF EXISTS "leadership_update_documents"     ON public.employee_documents;
DROP POLICY IF EXISTS "tl_select_team_documents"        ON public.employee_documents;

CREATE POLICY "leadership_select_all_documents"
  ON public.employee_documents FOR SELECT TO authenticated
  USING (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "leadership_insert_documents"
  ON public.employee_documents FOR INSERT TO authenticated
  WITH CHECK (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "leadership_update_documents"
  ON public.employee_documents FOR UPDATE TO authenticated
  USING (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  )
  WITH CHECK (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_select_team_documents"
  ON public.employee_documents FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND public.tl_employee_on_my_team(employee_id)
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

-- ===========================================================================
-- 7. compliance_notifications_sent
-- ===========================================================================
DROP POLICY IF EXISTS "leadership_select_compliance_notifications" ON public.compliance_notifications_sent;

CREATE POLICY "leadership_select_compliance_notifications"
  ON public.compliance_notifications_sent FOR SELECT TO authenticated
  USING (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

-- ===========================================================================
-- 8. hr_document_requests
--    TL policies use tl_employee_on_my_team() (rewritten 2026-04-23).
-- ===========================================================================
DROP POLICY IF EXISTS "leadership_all_hr_document_requests" ON public.hr_document_requests;
DROP POLICY IF EXISTS "tl_select_team_requests"             ON public.hr_document_requests;
DROP POLICY IF EXISTS "tl_insert_team_requests"             ON public.hr_document_requests;

CREATE POLICY "leadership_all_hr_document_requests"
  ON public.hr_document_requests FOR ALL TO authenticated
  USING (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  )
  WITH CHECK (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_select_team_requests"
  ON public.hr_document_requests FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND public.tl_employee_on_my_team(employee_id)
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_insert_team_requests"
  ON public.hr_document_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.is_team_lead()
    AND public.tl_employee_on_my_team(employee_id)
    AND filed_by = public.my_employee_id()
    AND status = 'pending'
    AND fulfilled_carta_id IS NULL
    AND fulfilled_acta_id IS NULL
    AND fulfilled_renuncia_id IS NULL
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

-- ===========================================================================
-- 9. cartas_compromiso
--    TL policy uses tl_employee_on_my_team() (rewritten 2026-04-23).
-- ===========================================================================
DROP POLICY IF EXISTS "leadership_all_cartas"   ON public.cartas_compromiso;
DROP POLICY IF EXISTS "tl_select_team_cartas"   ON public.cartas_compromiso;

CREATE POLICY "leadership_all_cartas"
  ON public.cartas_compromiso FOR ALL TO authenticated
  USING (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  )
  WITH CHECK (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_select_team_cartas"
  ON public.cartas_compromiso FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND public.tl_employee_on_my_team(employee_id)
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

-- ===========================================================================
-- 10. actas_administrativas
--     TL policy uses tl_employee_on_my_team() (rewritten 2026-04-23).
-- ===========================================================================
DROP POLICY IF EXISTS "leadership_all_actas"    ON public.actas_administrativas;
DROP POLICY IF EXISTS "tl_select_team_actas"    ON public.actas_administrativas;

CREATE POLICY "leadership_all_actas"
  ON public.actas_administrativas FOR ALL TO authenticated
  USING (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  )
  WITH CHECK (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_select_team_actas"
  ON public.actas_administrativas FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND public.tl_employee_on_my_team(employee_id)
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

-- ===========================================================================
-- 11. resignation_packets
--     TL policy uses tl_employee_on_my_team() (rewritten 2026-04-23).
-- ===========================================================================
DROP POLICY IF EXISTS "leadership_all_renuncias"   ON public.resignation_packets;
DROP POLICY IF EXISTS "tl_select_team_renuncias"   ON public.resignation_packets;

CREATE POLICY "leadership_all_renuncias"
  ON public.resignation_packets FOR ALL TO authenticated
  USING (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  )
  WITH CHECK (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_select_team_renuncias"
  ON public.resignation_packets FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND public.tl_employee_on_my_team(employee_id)
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

-- ===========================================================================
-- 12. eod_logs
--     TL policies use my_team_member_ids() (NOT tl_employee_on_my_team —
--     the 2026-04-23 fix did not cover this table).
-- ===========================================================================
DROP POLICY IF EXISTS "leadership_all_eod_logs"   ON public.eod_logs;
DROP POLICY IF EXISTS "tl_select_team_eod_logs"   ON public.eod_logs;
DROP POLICY IF EXISTS "tl_update_team_eod_logs"   ON public.eod_logs;

CREATE POLICY "leadership_all_eod_logs"
  ON public.eod_logs FOR ALL TO authenticated
  USING (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  )
  WITH CHECK (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_select_team_eod_logs"
  ON public.eod_logs FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND employee_id IN (SELECT public.my_team_member_ids())
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "tl_update_team_eod_logs"
  ON public.eod_logs FOR UPDATE TO authenticated
  USING (
    public.is_team_lead()
    AND employee_id IN (SELECT public.my_team_member_ids())
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

-- ===========================================================================
-- 13. policy_acknowledgments
-- ===========================================================================
DROP POLICY IF EXISTS "leadership_select_all_acks" ON public.policy_acknowledgments;

CREATE POLICY "leadership_select_all_acks"
  ON public.policy_acknowledgments FOR SELECT TO authenticated
  USING (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

-- ===========================================================================
-- 14. vacation_requests
--     TL policies use tl_employee_on_my_team() (defined in g1 migration).
-- ===========================================================================
DROP POLICY IF EXISTS "vacation_requests_leadership_all" ON public.vacation_requests;
DROP POLICY IF EXISTS "vacation_requests_tl_select"      ON public.vacation_requests;
DROP POLICY IF EXISTS "vacation_requests_tl_update"      ON public.vacation_requests;

CREATE POLICY "vacation_requests_leadership_all"
  ON public.vacation_requests FOR ALL TO authenticated
  USING (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  )
  WITH CHECK (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "vacation_requests_tl_select"
  ON public.vacation_requests FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND public.tl_employee_on_my_team(employee_id)
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "vacation_requests_tl_update"
  ON public.vacation_requests FOR UPDATE TO authenticated
  USING (
    public.is_team_lead()
    AND public.tl_employee_on_my_team(employee_id)
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

-- ===========================================================================
-- 15. holiday_requests
--     TL policies use tl_employee_on_my_team() (defined in d1 migration).
-- ===========================================================================
DROP POLICY IF EXISTS "holiday_requests_leadership_all" ON public.holiday_requests;
DROP POLICY IF EXISTS "holiday_requests_tl_select"      ON public.holiday_requests;
DROP POLICY IF EXISTS "holiday_requests_tl_update"      ON public.holiday_requests;

CREATE POLICY "holiday_requests_leadership_all"
  ON public.holiday_requests FOR ALL TO authenticated
  USING (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  )
  WITH CHECK (
    public.is_leadership()
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "holiday_requests_tl_select"
  ON public.holiday_requests FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND public.tl_employee_on_my_team(employee_id)
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

CREATE POLICY "holiday_requests_tl_update"
  ON public.holiday_requests FOR UPDATE TO authenticated
  USING (
    public.is_team_lead()
    AND public.tl_employee_on_my_team(employee_id)
    AND employee_id IN (SELECT id FROM public.employees WHERE organization_id = public.my_org_id())
  );

-- ===========================================================================
-- Reload PostgREST schema cache
-- ===========================================================================
NOTIFY pgrst, 'reload schema';
