-- Drop TL storage SELECT policy. TLs only need to see document status
-- (via the table-level tl_select_team_documents policy), not the actual
-- file contents. Defense in depth: even if a TL tries createSignedUrl
-- via devtools, storage RLS rejects it.

DROP POLICY IF EXISTS "tl_storage_select_team_documents" ON storage.objects;
