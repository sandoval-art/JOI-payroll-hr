-- Fix B-04: atomic version number computation.
-- INSERT ... SELECT max(version_number)+1 in one statement — no TOCTOU race.
-- SECURITY DEFINER with explicit is_leadership() gate.

CREATE OR REPLACE FUNCTION public.insert_policy_version(
  p_policy_id uuid,
  p_file_path text,
  p_file_name text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_uploaded_by uuid,
  p_change_notes text
)
RETURNS public.policy_document_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_row public.policy_document_versions;
BEGIN
  -- Authorization: mirror the INSERT RLS (leadership only)
  IF NOT public.is_leadership() THEN
    RAISE EXCEPTION 'Only leadership can publish policy versions';
  END IF;

  -- Atomic compute + insert in one statement, no race
  INSERT INTO public.policy_document_versions (
    policy_document_id, version_number, file_path, file_name,
    mime_type, file_size_bytes, uploaded_by, change_notes
  )
  SELECT
    p_policy_id,
    COALESCE(MAX(version_number), 0) + 1,
    p_file_path, p_file_name, p_mime_type, p_file_size_bytes,
    p_uploaded_by, p_change_notes
  FROM public.policy_document_versions
  WHERE policy_document_id = p_policy_id
  RETURNING * INTO new_row;

  RETURN new_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_policy_version TO authenticated;
