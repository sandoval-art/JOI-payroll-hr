-- A2c: Agent self-serve document upload
-- Allows agents to:
--   1. INSERT their own pending_review document rows
--   2. UPDATE their own REJECTED document rows back to pending_review (re-upload)
--   3. Upload files to storage under their own employee_id prefix
--
-- Agents CANNOT:
--   - Insert/update docs for other employees
--   - Set status to anything other than pending_review
--   - Modify pending_review or approved rows (only HR can)

-- ── employee_documents: agent INSERT ──────────────────────────────────
CREATE POLICY "agents_insert_own_documents"
  ON public.employee_documents FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = public.my_employee_id()
    AND status = 'pending_review'
    AND uploaded_by = auth.uid()
  );

-- ── employee_documents: agent UPDATE (rejected → pending_review) ──────
CREATE POLICY "agents_update_rejected_documents"
  ON public.employee_documents FOR UPDATE TO authenticated
  USING (
    employee_id = public.my_employee_id()
    AND status = 'rejected'
  )
  WITH CHECK (
    employee_id = public.my_employee_id()
    AND status = 'pending_review'
    AND uploaded_by = auth.uid()
  );

-- ── Storage: agent can upload files under their own prefix ────────────
CREATE POLICY "agents_storage_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-documents'
    AND (storage.foldername(name))[1] = public.my_employee_id()::text
  );
