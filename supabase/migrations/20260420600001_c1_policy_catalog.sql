-- C1: Policy catalog — documents, versioning, acknowledgment tracking
-- HR admin creates policies, uploads file versions, scopes by campaign/role.
-- Agent-facing UI (C2) plugs into acknowledgments later.

-- ── policy_documents (the catalog) ────────────────────────────────────
CREATE TABLE public.policy_documents (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title               text        NOT NULL,
  description         text,
  is_active           boolean     NOT NULL DEFAULT true,
  sort_order          integer     NOT NULL DEFAULT 0,
  is_global           boolean     NOT NULL DEFAULT true,
  scoped_campaign_ids uuid[],
  applicable_roles    text[],
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CHECK (is_global = true OR (scoped_campaign_ids IS NOT NULL AND array_length(scoped_campaign_ids, 1) > 0))
);

CREATE TRIGGER trg_policy_documents_updated_at
  BEFORE UPDATE ON public.policy_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── policy_document_versions ──────────────────────────────────────────
CREATE TABLE public.policy_document_versions (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_document_id   uuid        NOT NULL REFERENCES public.policy_documents(id) ON DELETE CASCADE,
  version_number       integer     NOT NULL,
  file_path            text        NOT NULL,
  file_name            text        NOT NULL,
  mime_type            text        NOT NULL,
  file_size_bytes      bigint      NOT NULL,
  uploaded_by          uuid        NOT NULL REFERENCES public.employees(id),
  published_at         timestamptz NOT NULL DEFAULT now(),
  change_notes         text,
  created_at           timestamptz NOT NULL DEFAULT now(),

  UNIQUE (policy_document_id, version_number)
);

-- ── policy_acknowledgments ────────────────────────────────────────────
CREATE TABLE public.policy_acknowledgments (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id                 uuid        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  policy_document_version_id  uuid        NOT NULL REFERENCES public.policy_document_versions(id) ON DELETE RESTRICT,
  acknowledged_at             timestamptz NOT NULL DEFAULT now(),

  UNIQUE (employee_id, policy_document_version_id)
);

CREATE INDEX idx_policy_acknowledgments_employee
  ON public.policy_acknowledgments (employee_id);

-- ── RLS: policy_documents ─────────────────────────────────────────────
ALTER TABLE public.policy_documents ENABLE ROW LEVEL SECURITY;

-- Leadership: full CRUD
CREATE POLICY "leadership_all_policies"
  ON public.policy_documents FOR ALL TO authenticated
  USING (public.is_leadership())
  WITH CHECK (public.is_leadership());

-- Authenticated users: see active policies scoped to them
CREATE POLICY "authenticated_select_policies_for_me"
  ON public.policy_documents FOR SELECT TO authenticated
  USING (
    is_active = true
    AND (
      is_global = true
      OR EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.id = public.my_employee_id()
          AND e.campaign_id = ANY(scoped_campaign_ids)
      )
    )
    AND (
      applicable_roles IS NULL
      OR EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.id = public.my_employee_id()
          AND e.title = ANY(applicable_roles)
      )
    )
  );

-- ── RLS: policy_document_versions ─────────────────────────────────────
ALTER TABLE public.policy_document_versions ENABLE ROW LEVEL SECURITY;

-- All authenticated can SELECT (parent policy RLS is the real gate)
CREATE POLICY "authenticated_select_versions"
  ON public.policy_document_versions FOR SELECT TO authenticated
  USING (true);

-- Leadership: insert + update (change_notes corrections)
CREATE POLICY "leadership_insert_versions"
  ON public.policy_document_versions FOR INSERT TO authenticated
  WITH CHECK (public.is_leadership());

CREATE POLICY "leadership_update_versions"
  ON public.policy_document_versions FOR UPDATE TO authenticated
  USING (public.is_leadership());

-- NO DELETE

-- ── RLS: policy_acknowledgments ───────────────────────────────────────
ALTER TABLE public.policy_acknowledgments ENABLE ROW LEVEL SECURITY;

-- Agents insert own acks (C2 will use this)
CREATE POLICY "agents_insert_own_acks"
  ON public.policy_acknowledgments FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.my_employee_id());

-- Agents see own acks
CREATE POLICY "agents_select_own_acks"
  ON public.policy_acknowledgments FOR SELECT TO authenticated
  USING (employee_id = public.my_employee_id());

-- Leadership sees all acks
CREATE POLICY "leadership_select_all_acks"
  ON public.policy_acknowledgments FOR SELECT TO authenticated
  USING (public.is_leadership());

-- NO UPDATE, NO DELETE
