-- B2/B3 Phase 1: Data model for cartas de compromiso + actas administrativas
-- Three tables + one storage bucket. No UI, no hooks, no edge functions.
-- Phase 1 of 5 — see docs/hr-roadmap.md § Feature B.

-- ── Table: cartas_compromiso ────────────────────────────────────────────
-- Created first so hr_document_requests can reference it.

CREATE TABLE public.cartas_compromiso (
  id                              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id                     uuid        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  request_id                      uuid,       -- FK added after hr_document_requests exists
  doc_ref                         text        UNIQUE,
  incident_date                   date        NOT NULL,
  narrative                       text,
  kpi_table                       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  trabajador_name_snapshot        text,
  puesto_snapshot                  text,
  horario_snapshot                 text,
  supervisor_name_snapshot        text,
  company_legal_name_snapshot     text,
  company_legal_address_snapshot  text,
  incident_date_long_snapshot     text,
  pdf_path                        text,
  signed_at                       timestamptz,
  signed_scan_path                text,
  created_by                      uuid        NOT NULL REFERENCES public.employees(id),
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),

  CHECK ((signed_at IS NULL) = (signed_scan_path IS NULL))
);

CREATE INDEX idx_cartas_compromiso_employee
  ON public.cartas_compromiso (employee_id, created_at DESC);

CREATE TRIGGER trg_cartas_compromiso_updated_at
  BEFORE UPDATE ON public.cartas_compromiso
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Table: actas_administrativas ────────────────────────────────────────

CREATE TABLE public.actas_administrativas (
  id                              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id                     uuid        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  request_id                      uuid,       -- FK added after hr_document_requests exists
  doc_ref                         text        UNIQUE,
  incident_date                   date        NOT NULL,
  narrative                       text,
  witnesses                       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  reincidencia_prior_carta_id     uuid        REFERENCES public.cartas_compromiso(id) ON DELETE SET NULL,
  trabajador_name_snapshot        text,
  puesto_snapshot                 text,
  horario_snapshot                text,
  supervisor_name_snapshot        text,
  company_legal_name_snapshot     text,
  company_legal_address_snapshot  text,
  incident_date_long_snapshot     text,
  pdf_path                        text,
  signed_at                       timestamptz,
  signed_scan_path                text,
  created_by                      uuid        NOT NULL REFERENCES public.employees(id),
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),

  CHECK ((signed_at IS NULL) = (signed_scan_path IS NULL))
);

CREATE INDEX idx_actas_administrativas_employee
  ON public.actas_administrativas (employee_id, created_at DESC);

CREATE INDEX idx_actas_administrativas_reincidencia
  ON public.actas_administrativas (reincidencia_prior_carta_id);

CREATE TRIGGER trg_actas_administrativas_updated_at
  BEFORE UPDATE ON public.actas_administrativas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Table: hr_document_requests ─────────────────────────────────────────

CREATE TABLE public.hr_document_requests (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         uuid        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  request_type        text        NOT NULL CHECK (request_type IN ('carta', 'acta')),
  status              text        NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'in_progress', 'fulfilled', 'canceled', 'downgraded')),
  filed_by            uuid        NOT NULL REFERENCES public.employees(id),
  filed_at            timestamptz NOT NULL DEFAULT now(),
  incident_date       date        NOT NULL,
  tl_narrative        text        NOT NULL,
  reason              text,
  fulfilled_carta_id  uuid        REFERENCES public.cartas_compromiso(id) ON DELETE SET NULL
                      DEFERRABLE INITIALLY DEFERRED,
  fulfilled_acta_id   uuid        REFERENCES public.actas_administrativas(id) ON DELETE SET NULL
                      DEFERRABLE INITIALLY DEFERRED,
  canceled_reason     text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- At most one fulfilled link
  CHECK (fulfilled_carta_id IS NULL OR fulfilled_acta_id IS NULL),
  -- fulfilled status ↔ exactly one link present
  CHECK ((status = 'fulfilled') = (fulfilled_carta_id IS NOT NULL OR fulfilled_acta_id IS NOT NULL))
);

CREATE INDEX idx_hr_document_requests_employee
  ON public.hr_document_requests (employee_id, filed_at DESC);

CREATE INDEX idx_hr_document_requests_status
  ON public.hr_document_requests (status);

CREATE INDEX idx_hr_document_requests_filed_by
  ON public.hr_document_requests (filed_by);

CREATE TRIGGER trg_hr_document_requests_updated_at
  BEFORE UPDATE ON public.hr_document_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Back-FKs: cartas/actas → hr_document_requests ──────────────────────
-- Added via ALTER TABLE since the requests table didn't exist when
-- cartas/actas were created.

ALTER TABLE public.cartas_compromiso
  ADD CONSTRAINT fk_cartas_request_id
  FOREIGN KEY (request_id)
  REFERENCES public.hr_document_requests(id)
  ON DELETE SET NULL;

CREATE INDEX idx_cartas_compromiso_request
  ON public.cartas_compromiso (request_id);

ALTER TABLE public.actas_administrativas
  ADD CONSTRAINT fk_actas_request_id
  FOREIGN KEY (request_id)
  REFERENCES public.hr_document_requests(id)
  ON DELETE SET NULL;

CREATE INDEX idx_actas_administrativas_request
  ON public.actas_administrativas (request_id);

-- ── Storage bucket: hr-documents ────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('hr-documents', 'hr-documents', false)
ON CONFLICT (id) DO NOTHING;

-- ── RLS: hr_document_requests ───────────────────────────────────────────

ALTER TABLE public.hr_document_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leadership_all_hr_document_requests"
  ON public.hr_document_requests FOR ALL TO authenticated
  USING (public.is_leadership())
  WITH CHECK (public.is_leadership());

CREATE POLICY "tl_select_team_requests"
  ON public.hr_document_requests FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND employee_id IN (
      SELECT e.id FROM public.employees e
      WHERE e.campaign_id IN (SELECT public.my_tl_campaign_ids())
    )
  );

CREATE POLICY "tl_insert_team_requests"
  ON public.hr_document_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.is_team_lead()
    AND employee_id IN (
      SELECT e.id FROM public.employees e
      WHERE e.campaign_id IN (SELECT public.my_tl_campaign_ids())
    )
    AND filed_by = public.my_employee_id()
    AND status = 'pending'
    AND fulfilled_carta_id IS NULL
    AND fulfilled_acta_id IS NULL
  );

-- NO TL update/delete — HR owns the workflow after filing
-- NO agent access

-- ── RLS: cartas_compromiso ──────────────────────────────────────────────

ALTER TABLE public.cartas_compromiso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leadership_all_cartas"
  ON public.cartas_compromiso FOR ALL TO authenticated
  USING (public.is_leadership())
  WITH CHECK (public.is_leadership());

CREATE POLICY "tl_select_team_cartas"
  ON public.cartas_compromiso FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND employee_id IN (
      SELECT e.id FROM public.employees e
      WHERE e.campaign_id IN (SELECT public.my_tl_campaign_ids())
    )
  );

CREATE POLICY "agents_select_own_signed_cartas"
  ON public.cartas_compromiso FOR SELECT TO authenticated
  USING (
    employee_id = public.my_employee_id()
    AND signed_at IS NOT NULL
    AND signed_scan_path IS NOT NULL
  );

-- NO agent/TL insert/update/delete

-- ── RLS: actas_administrativas ──────────────────────────────────────────

ALTER TABLE public.actas_administrativas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leadership_all_actas"
  ON public.actas_administrativas FOR ALL TO authenticated
  USING (public.is_leadership())
  WITH CHECK (public.is_leadership());

CREATE POLICY "tl_select_team_actas"
  ON public.actas_administrativas FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND employee_id IN (
      SELECT e.id FROM public.employees e
      WHERE e.campaign_id IN (SELECT public.my_tl_campaign_ids())
    )
  );

CREATE POLICY "agents_select_own_signed_actas"
  ON public.actas_administrativas FOR SELECT TO authenticated
  USING (
    employee_id = public.my_employee_id()
    AND signed_at IS NOT NULL
    AND signed_scan_path IS NOT NULL
  );

-- NO agent/TL insert/update/delete

-- ── Storage RLS: hr-documents ───────────────────────────────────────────
-- Leadership-only. TL/agent access to files is via signed URLs issued by
-- edge functions (service_role bypass), gated by table-level RLS on
-- cartas/actas. Simpler + one fewer place to get wrong.

CREATE POLICY "leadership_storage_hr_documents_all"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'hr-documents'
    AND public.is_leadership()
  )
  WITH CHECK (
    bucket_id = 'hr-documents'
    AND public.is_leadership()
  );
