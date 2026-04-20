-- B4: Storage bucket for attendance incident supporting documents
-- (doctor's notes, medical leave certificates, etc.)

-- ── Bucket ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-docs', 'attendance-docs', false)
ON CONFLICT (id) DO NOTHING;

-- ── Storage RLS ───────────────────────────────────────────────────────

-- Leadership: full access
CREATE POLICY "leadership_storage_attendance_all"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'attendance-docs'
    AND public.is_leadership()
  )
  WITH CHECK (
    bucket_id = 'attendance-docs'
    AND public.is_leadership()
  );

-- TL: SELECT files for team agents
CREATE POLICY "tl_storage_attendance_team_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'attendance-docs'
    AND public.is_team_lead()
    AND (storage.foldername(name))[1] IN (
      SELECT e.id::text FROM public.employees e
      WHERE e.campaign_id IN (SELECT public.my_tl_campaign_ids())
    )
  );

-- TL: INSERT files for team agents
CREATE POLICY "tl_storage_attendance_team_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attendance-docs'
    AND public.is_team_lead()
    AND (storage.foldername(name))[1] IN (
      SELECT e.id::text FROM public.employees e
      WHERE e.campaign_id IN (SELECT public.my_tl_campaign_ids())
    )
  );

-- Agent: can view own supporting docs
CREATE POLICY "agents_storage_attendance_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'attendance-docs'
    AND (storage.foldername(name))[1] = public.my_employee_id()::text
  );
