-- C1: Storage bucket for policy document files (PDFs, etc.)

INSERT INTO storage.buckets (id, name, public)
VALUES ('policy-documents', 'policy-documents', false)
ON CONFLICT (id) DO NOTHING;

-- ── Storage RLS ───────────────────────────────────────────────────────

-- Leadership: full access (upload, view, manage)
CREATE POLICY "leadership_storage_policies_all"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'policy-documents'
    AND public.is_leadership()
  )
  WITH CHECK (
    bucket_id = 'policy-documents'
    AND public.is_leadership()
  );

-- All authenticated: can read policy files (the policy_documents RLS is the
-- real gate — if a user can't see the policy record they won't know the path)
CREATE POLICY "authenticated_storage_policies_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'policy-documents');
