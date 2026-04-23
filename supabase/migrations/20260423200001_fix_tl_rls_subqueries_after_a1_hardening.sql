-- Fix: TL-facing RLS policies on 6 tables used a subquery against the employees
-- base table. The A1 hardening (PR #32, 2026-04-21) tightened employees RLS so
-- TLs can't SELECT from the base table — TLs only go through employees_no_pay.
-- That made every such subquery return empty under a TL's auth context,
-- silently breaking TL INSERTs/SELECTs across the entire HR suite.
--
-- Surfaced 2026-04-23 when D first tested the TL flow for Feature F: "Solicitar
-- renuncia" / "Solicitar acta" both returned "new row violates row-level security
-- policy for table 'hr_document_requests'". Same bug applied to tl_select_*
-- across hr_document_requests, cartas_compromiso, actas_administrativas,
-- resignation_packets, attendance_incidents (all cmds), employee_documents,
-- and storage.objects (attendance-docs bucket).
--
-- Fix: introduce a SECURITY DEFINER helper that bypasses RLS for the specific
-- team-scope check. Policies call the helper instead of the subquery. Applied
-- via Cowork MCP 2026-04-23; this file commits for audit trail.

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
      AND e.campaign_id IN (SELECT public.my_tl_campaign_ids())
  );
$$;

GRANT EXECUTE ON FUNCTION public.tl_employee_on_my_team(uuid) TO authenticated;

-- ── hr_document_requests ────────────────────────────────────────────

DROP POLICY IF EXISTS "tl_insert_team_requests" ON public.hr_document_requests;
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
  );

DROP POLICY IF EXISTS "tl_select_team_requests" ON public.hr_document_requests;
CREATE POLICY "tl_select_team_requests"
  ON public.hr_document_requests FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND public.tl_employee_on_my_team(employee_id)
  );

-- ── cartas_compromiso ───────────────────────────────────────────────

DROP POLICY IF EXISTS "tl_select_team_cartas" ON public.cartas_compromiso;
CREATE POLICY "tl_select_team_cartas"
  ON public.cartas_compromiso FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND public.tl_employee_on_my_team(employee_id)
  );

-- ── actas_administrativas ───────────────────────────────────────────

DROP POLICY IF EXISTS "tl_select_team_actas" ON public.actas_administrativas;
CREATE POLICY "tl_select_team_actas"
  ON public.actas_administrativas FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND public.tl_employee_on_my_team(employee_id)
  );

-- ── resignation_packets ─────────────────────────────────────────────

DROP POLICY IF EXISTS "tl_select_team_renuncias" ON public.resignation_packets;
CREATE POLICY "tl_select_team_renuncias"
  ON public.resignation_packets FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND public.tl_employee_on_my_team(employee_id)
  );

-- ── attendance_incidents ────────────────────────────────────────────

DROP POLICY IF EXISTS "tl_select_team_incidents" ON public.attendance_incidents;
CREATE POLICY "tl_select_team_incidents"
  ON public.attendance_incidents FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND public.tl_employee_on_my_team(employee_id)
  );

DROP POLICY IF EXISTS "tl_insert_team_incidents" ON public.attendance_incidents;
CREATE POLICY "tl_insert_team_incidents"
  ON public.attendance_incidents FOR INSERT TO authenticated
  WITH CHECK (
    public.is_team_lead()
    AND public.tl_employee_on_my_team(employee_id)
    AND created_by = public.my_employee_id()
  );

DROP POLICY IF EXISTS "tl_update_team_incidents" ON public.attendance_incidents;
CREATE POLICY "tl_update_team_incidents"
  ON public.attendance_incidents FOR UPDATE TO authenticated
  USING (
    public.is_team_lead()
    AND public.tl_employee_on_my_team(employee_id)
  )
  WITH CHECK (
    public.is_team_lead()
    AND public.tl_employee_on_my_team(employee_id)
  );

-- ── employee_documents ──────────────────────────────────────────────

DROP POLICY IF EXISTS "tl_select_team_documents" ON public.employee_documents;
CREATE POLICY "tl_select_team_documents"
  ON public.employee_documents FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND public.tl_employee_on_my_team(employee_id)
  );

-- ── storage.objects (attendance-docs bucket) ────────────────────────
-- Path pattern: {employee_id}/{filename}. Helper takes the foldername[1] cast to uuid.

DROP POLICY IF EXISTS "tl_storage_attendance_team_select" ON storage.objects;
CREATE POLICY "tl_storage_attendance_team_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'attendance-docs'
    AND public.is_team_lead()
    AND public.tl_employee_on_my_team(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "tl_storage_attendance_team_insert" ON storage.objects;
CREATE POLICY "tl_storage_attendance_team_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attendance-docs'
    AND public.is_team_lead()
    AND public.tl_employee_on_my_team(((storage.foldername(name))[1])::uuid)
  );

COMMENT ON FUNCTION public.tl_employee_on_my_team(uuid) IS
  'Returns true if the given employee belongs to a campaign the current auth '
  'user is team_lead of. SECURITY DEFINER to bypass employees RLS — the A1 '
  'hardening prevents TLs from SELECTing the base table. Used by TL-facing '
  'policies across hr_document_requests, cartas_compromiso, actas_administrativas, '
  'resignation_packets, attendance_incidents, employee_documents, and storage.';
