-- Fix S-01: versions inherit parent policy visibility.
-- Previously USING (true) — any authenticated user could enumerate all
-- version metadata including file paths for out-of-scope policies.
DROP POLICY "authenticated_select_versions" ON public.policy_document_versions;

CREATE POLICY "authenticated_select_versions_inherit"
  ON public.policy_document_versions FOR SELECT TO authenticated
  USING (
    public.is_leadership()
    OR policy_document_id IN (SELECT id FROM public.policy_documents)
  );

-- Fix S-02: storage SELECT restricted to visible policies' folders.
-- Previously any authenticated user could download any file by path.
DROP POLICY "authenticated_storage_policies_select" ON storage.objects;

CREATE POLICY "authenticated_storage_policies_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'policy-documents'
    AND (
      public.is_leadership()
      OR (storage.foldername(name))[1]::uuid IN (
        SELECT id FROM public.policy_documents
      )
    )
  );
