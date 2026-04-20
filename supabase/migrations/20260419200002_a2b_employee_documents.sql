-- A2b: employee_documents table + employee-documents storage bucket
-- Depends on: required_document_types (A2a), employees, auth.users

-- ── Table ───────────────────────────────────────────────────────────
CREATE TABLE public.employee_documents (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       uuid        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  document_type_id  uuid        NOT NULL REFERENCES public.required_document_types(id) ON DELETE RESTRICT,
  file_path         text        NOT NULL,
  file_name         text        NOT NULL,
  mime_type         text        NOT NULL,
  file_size_bytes   bigint      NOT NULL,
  status            text        NOT NULL DEFAULT 'pending_review'
                    CHECK (status IN ('pending_review', 'approved', 'rejected')),
  rejection_reason  text,
  uploaded_by       uuid        NOT NULL REFERENCES auth.users(id),
  uploaded_at       timestamptz NOT NULL DEFAULT now(),
  reviewed_by       uuid        REFERENCES auth.users(id),
  reviewed_at       timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- One current doc per (employee, type). Re-upload replaces via UPSERT.
  UNIQUE (employee_id, document_type_id),

  -- If rejected, a reason must be provided
  CHECK (status <> 'rejected' OR rejection_reason IS NOT NULL)
);

-- Reuse existing trigger
CREATE TRIGGER trg_employee_documents_updated_at
  BEFORE UPDATE ON public.employee_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS on employee_documents ───────────────────────────────────────
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

-- Agents can read their own documents
CREATE POLICY "agents_select_own_documents"
  ON public.employee_documents FOR SELECT TO authenticated
  USING (employee_id = public.my_employee_id());

-- Leadership can read all documents
CREATE POLICY "leadership_select_all_documents"
  ON public.employee_documents FOR SELECT TO authenticated
  USING (public.is_leadership());

-- Leadership can insert documents (upload on behalf of employee)
CREATE POLICY "leadership_insert_documents"
  ON public.employee_documents FOR INSERT TO authenticated
  WITH CHECK (public.is_leadership());

-- Leadership can update documents (approve, reject, re-upload)
CREATE POLICY "leadership_update_documents"
  ON public.employee_documents FOR UPDATE TO authenticated
  USING (public.is_leadership())
  WITH CHECK (public.is_leadership());

-- No DELETE policy — preserve history

-- ── Storage bucket ──────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-documents', 'employee-documents', false)
ON CONFLICT (id) DO NOTHING;

-- ── Storage RLS policies ────────────────────────────────────────────

-- Leadership can do everything
CREATE POLICY "leadership_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND public.is_leadership()
  );

CREATE POLICY "leadership_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-documents'
    AND public.is_leadership()
  );

CREATE POLICY "leadership_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND public.is_leadership()
  )
  WITH CHECK (
    bucket_id = 'employee-documents'
    AND public.is_leadership()
  );

-- Agents can read files under their own employee_id prefix
CREATE POLICY "agents_storage_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND (storage.foldername(name))[1] = public.my_employee_id()::text
  );
