-- B2/B3 Phase 5b: RPC to atomically mark a carta/acta as signed
-- and transition the parent request to 'fulfilled' status.

CREATE OR REPLACE FUNCTION public.hr_mark_finalization_signed(
  p_finalization_id uuid,
  p_type text,
  p_signed_scan_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request_id uuid;
BEGIN
  IF NOT public.is_leadership() THEN
    RAISE EXCEPTION 'Forbidden: only leadership may mark docs as signed'
      USING ERRCODE = '42501';
  END IF;

  IF p_type NOT IN ('carta', 'acta') THEN
    RAISE EXCEPTION 'Unknown type: %', p_type USING ERRCODE = '22023';
  END IF;

  IF p_type = 'carta' THEN
    UPDATE public.cartas_compromiso
       SET signed_at = now(),
           signed_scan_path = p_signed_scan_path
     WHERE id = p_finalization_id
    RETURNING request_id INTO v_request_id;
  ELSE
    UPDATE public.actas_administrativas
       SET signed_at = now(),
           signed_scan_path = p_signed_scan_path
     WHERE id = p_finalization_id
    RETURNING request_id INTO v_request_id;
  END IF;

  IF v_request_id IS NULL THEN
    RAISE EXCEPTION 'Finalization row not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.hr_document_requests
     SET status = 'fulfilled',
         canceled_reason = NULL
   WHERE id = v_request_id
     AND status <> 'fulfilled';

  RETURN jsonb_build_object(
    'request_id', v_request_id,
    'finalization_id', p_finalization_id,
    'status', 'fulfilled'
  );
END;
$$;

COMMENT ON FUNCTION public.hr_mark_finalization_signed(uuid, text, text) IS
  'Atomically marks a carta/acta as signed (sets signed_at + signed_scan_path) '
  'and transitions the request to fulfilled status. Idempotent — re-upload '
  'of a replacement scan updates both fields and re-asserts fulfilled status.';

GRANT EXECUTE ON FUNCTION public.hr_mark_finalization_signed(uuid, text, text)
  TO authenticated;
