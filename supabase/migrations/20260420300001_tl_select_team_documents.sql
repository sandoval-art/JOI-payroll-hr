-- TL read access to employee documents for agents on their campaigns.
-- Grants SELECT only (no INSERT/UPDATE/DELETE) so TLs can inspect
-- document status and view files but cannot upload or approve/reject.

CREATE POLICY "tl_select_team_documents"
  ON public.employee_documents FOR SELECT TO authenticated
  USING (
    is_team_lead()
    AND employee_id IN (
      SELECT e.id FROM public.employees e
      WHERE e.campaign_id IN (SELECT public.my_tl_campaign_ids())
    )
  );

CREATE POLICY "tl_storage_select_team_documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND is_team_lead()
    AND (storage.foldername(name))[1] IN (
      SELECT e.id::text FROM public.employees e
      WHERE e.campaign_id IN (SELECT public.my_tl_campaign_ids())
    )
  );
