-- Feature F Phase 1: Resignation packet data model.
-- New table resignation_packets, extends hr_document_requests with
-- request_type='renuncia', extends both finalization RPCs.

-- ── Table: resignation_packets ──────────────────────────────────────

CREATE TABLE public.resignation_packets (
  id                              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id                     uuid        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  request_id                      uuid        REFERENCES public.hr_document_requests(id) ON DELETE SET NULL,
  doc_ref                         text        UNIQUE,

  -- Snapshot fields (reused from cartas/actas)
  trabajador_name_snapshot        text,
  puesto_snapshot                 text,
  horario_snapshot                text,
  company_legal_name_snapshot     text,
  company_legal_address_snapshot  text,

  -- Renuncia-specific
  effective_date                  date        NOT NULL,
  renuncia_narrative              text,

  -- Finiquito calculations (frozen at generation time)
  hire_date_snapshot              date,
  salario_diario_snapshot         numeric(12,2),
  aguinaldo_monto                 numeric(12,2),
  vacaciones_monto                numeric(12,2),
  prima_vacacional_monto          numeric(12,2),
  total_monto                     numeric(12,2),
  total_en_letras                 text,

  -- Identity snapshots
  curp_snapshot                   text,
  rfc_snapshot                    text,
  clave_elector                   text,

  -- Signing (reuses carta/acta pattern)
  pdf_path                        text,
  signed_at                       timestamptz,
  signed_scan_path                text,

  created_by                      uuid        NOT NULL REFERENCES public.employees(id),
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),

  CHECK ((signed_at IS NULL) = (signed_scan_path IS NULL))
);

CREATE INDEX idx_resignation_packets_employee
  ON public.resignation_packets (employee_id, created_at DESC);

CREATE INDEX idx_resignation_packets_request
  ON public.resignation_packets (request_id);

CREATE TRIGGER trg_resignation_packets_updated_at
  BEFORE UPDATE ON public.resignation_packets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Extend hr_document_requests ─────────────────────────────────────

-- Add fulfilled_renuncia_id FK
ALTER TABLE public.hr_document_requests
  ADD COLUMN fulfilled_renuncia_id uuid
  REFERENCES public.resignation_packets(id) ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- Drop old CHECK constraints and recreate with renuncia support.
-- Inline CHECKs from the CREATE TABLE don't have user-chosen names;
-- Postgres generates them. Query pg_constraint to find them.
DO $$
DECLARE
  r record;
BEGIN
  -- Drop all CHECK constraints on hr_document_requests that reference
  -- request_type, fulfilled_carta_id, fulfilled_acta_id, or the
  -- status↔fulfilled relationship. Keep status-values CHECK intact
  -- (it already includes 'fulfilled').
  FOR r IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'public.hr_document_requests'::regclass
       AND contype = 'c'
       AND (   pg_get_constraintdef(oid) LIKE '%request_type%'
            OR pg_get_constraintdef(oid) LIKE '%fulfilled_carta_id%'
            OR pg_get_constraintdef(oid) LIKE '%fulfilled_acta_id%')
  LOOP
    EXECUTE format('ALTER TABLE public.hr_document_requests DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- Recreate with renuncia included
ALTER TABLE public.hr_document_requests
  ADD CONSTRAINT hr_document_requests_request_type_check
  CHECK (request_type IN ('carta', 'acta', 'renuncia'));

ALTER TABLE public.hr_document_requests
  ADD CONSTRAINT hr_document_requests_at_most_one_fulfilled
  CHECK (
    (CASE WHEN fulfilled_carta_id IS NOT NULL THEN 1 ELSE 0 END
   + CASE WHEN fulfilled_acta_id IS NOT NULL THEN 1 ELSE 0 END
   + CASE WHEN fulfilled_renuncia_id IS NOT NULL THEN 1 ELSE 0 END) <= 1
  );

ALTER TABLE public.hr_document_requests
  ADD CONSTRAINT hr_document_requests_fulfilled_status_sync
  CHECK (
    (status = 'fulfilled') = (
      fulfilled_carta_id IS NOT NULL
      OR fulfilled_acta_id IS NOT NULL
      OR fulfilled_renuncia_id IS NOT NULL
    )
  );

-- ── RLS: resignation_packets ────────────────────────────────────────

ALTER TABLE public.resignation_packets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leadership_all_renuncias"
  ON public.resignation_packets FOR ALL TO authenticated
  USING (public.is_leadership())
  WITH CHECK (public.is_leadership());

CREATE POLICY "tl_select_team_renuncias"
  ON public.resignation_packets FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND employee_id IN (
      SELECT e.id FROM public.employees e
      WHERE e.campaign_id IN (SELECT public.my_tl_campaign_ids())
    )
  );

CREATE POLICY "agents_select_own_signed_renuncias"
  ON public.resignation_packets FOR SELECT TO authenticated
  USING (
    employee_id = public.my_employee_id()
    AND signed_at IS NOT NULL
    AND signed_scan_path IS NOT NULL
  );

-- ── Extend hr_create_finalization_draft RPC ─────────────────────────

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

  IF v_request.fulfilled_carta_id IS NOT NULL
     OR v_request.fulfilled_acta_id IS NOT NULL
     OR v_request.fulfilled_renuncia_id IS NOT NULL THEN
    RAISE EXCEPTION 'Request already has a finalization row'
      USING ERRCODE = 'P0001';
  END IF;

  v_type := v_request.request_type;

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

  ELSIF v_type = 'renuncia' THEN
    v_doc_ref := 'RN' || to_char(
      now() AT TIME ZONE 'America/Mexico_City', 'YYYYMMDD-HH24MI'
    );
    INSERT INTO public.resignation_packets (
      employee_id, request_id, doc_ref, effective_date, created_by
    ) VALUES (
      v_request.employee_id, p_request_id, v_doc_ref,
      v_request.incident_date, p_created_by
    ) RETURNING id INTO v_new_id;

    UPDATE public.hr_document_requests
       SET fulfilled_renuncia_id = v_new_id,
           status = CASE WHEN status = 'pending' THEN 'in_progress'
                         ELSE status END
     WHERE id = p_request_id;

  ELSE
    RAISE EXCEPTION 'Unknown request_type: %', v_type;
  END IF;

  RETURN jsonb_build_object('id', v_new_id, 'type', v_type, 'doc_ref', v_doc_ref);
END;
$$;

-- ── Extend hr_mark_finalization_signed RPC ──────────────────────────

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

  IF p_type NOT IN ('carta', 'acta', 'renuncia') THEN
    RAISE EXCEPTION 'Unknown type: %', p_type USING ERRCODE = '22023';
  END IF;

  IF p_type = 'carta' THEN
    UPDATE public.cartas_compromiso
       SET signed_at = now(),
           signed_scan_path = p_signed_scan_path
     WHERE id = p_finalization_id
    RETURNING request_id INTO v_request_id;
  ELSIF p_type = 'acta' THEN
    UPDATE public.actas_administrativas
       SET signed_at = now(),
           signed_scan_path = p_signed_scan_path
     WHERE id = p_finalization_id
    RETURNING request_id INTO v_request_id;
  ELSE
    UPDATE public.resignation_packets
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
