-- B2/B3 Phase 4a: RPC to atomically create a finalization draft row
-- (carta_compromiso or acta_administrativa) and link it back to the
-- hr_document_request. One function handles both types.

CREATE OR REPLACE FUNCTION public.hr_create_finalization_draft(
  p_request_id uuid,
  p_created_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request  record;
  v_doc_ref  text;
  v_new_id   uuid;
  v_type     text;
BEGIN
  -- Authorization: only leadership may create finalization drafts
  IF NOT public.is_leadership() THEN
    RAISE EXCEPTION 'Forbidden: only leadership may create finalization drafts'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_request
    FROM public.hr_document_requests
   WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0002';
  END IF;

  -- Block double-create
  IF v_request.fulfilled_carta_id IS NOT NULL
     OR v_request.fulfilled_acta_id IS NOT NULL THEN
    RAISE EXCEPTION 'Request already has a finalization row'
      USING ERRCODE = 'P0001';
  END IF;

  v_type := v_request.request_type;

  -- doc_ref: CC{YYYYMMDD}-{HHMM} for carta, {YYYYMMDD}-{HHMM} for acta
  IF v_type = 'carta' THEN
    v_doc_ref := 'CC' || to_char(
      now() AT TIME ZONE 'America/Mexico_City', 'YYYYMMDD-HH24MI'
    );

    INSERT INTO public.cartas_compromiso (
      employee_id, request_id, doc_ref, incident_date, kpi_table, created_by
    ) VALUES (
      v_request.employee_id, p_request_id, v_doc_ref,
      v_request.incident_date, '[]'::jsonb, p_created_by
    ) RETURNING id INTO v_new_id;

    UPDATE public.hr_document_requests
       SET fulfilled_carta_id = v_new_id,
           status = CASE WHEN status = 'pending' THEN 'in_progress'
                         ELSE status END
     WHERE id = p_request_id;

  ELSIF v_type = 'acta' THEN
    v_doc_ref := to_char(
      now() AT TIME ZONE 'America/Mexico_City', 'YYYYMMDD-HH24MI'
    );

    INSERT INTO public.actas_administrativas (
      employee_id, request_id, doc_ref, incident_date, witnesses, created_by
    ) VALUES (
      v_request.employee_id, p_request_id, v_doc_ref,
      v_request.incident_date, '[]'::jsonb, p_created_by
    ) RETURNING id INTO v_new_id;

    UPDATE public.hr_document_requests
       SET fulfilled_acta_id = v_new_id,
           status = CASE WHEN status = 'pending' THEN 'in_progress'
                         ELSE status END
     WHERE id = p_request_id;

  ELSE
    RAISE EXCEPTION 'Unknown request_type: %', v_type;
  END IF;

  RETURN jsonb_build_object('id', v_new_id, 'type', v_type, 'doc_ref', v_doc_ref);
END;
$$;

COMMENT ON FUNCTION public.hr_create_finalization_draft(uuid, uuid) IS
  'Atomically creates a carta_compromiso or acta_administrativa draft row '
  'and links it to the hr_document_request. Auto-generates doc_ref with MX '
  'timestamp. Transitions pending requests to in_progress.';

GRANT EXECUTE ON FUNCTION public.hr_create_finalization_draft(uuid, uuid)
  TO authenticated;
