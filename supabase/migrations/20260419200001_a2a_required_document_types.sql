-- A2a: Admin-managed required document types list
-- Prerequisite for A2b (actual file uploads + per-employee tracking).
-- This table defines WHAT documents are required; A2b tracks WHO has submitted them.

-- ============================================================================
-- TABLE
-- ============================================================================

CREATE TABLE public.required_document_types (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL UNIQUE,
  description text,
  is_active   boolean     NOT NULL DEFAULT true,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Reuse the existing set_updated_at() function from eod_digest_foundation
CREATE TRIGGER trg_required_document_types_updated_at
  BEFORE UPDATE ON public.required_document_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE public.required_document_types ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read (agents need to see what's required)
CREATE POLICY "authenticated_select_required_document_types"
  ON public.required_document_types
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Leadership can insert
CREATE POLICY "leadership_insert_required_document_types"
  ON public.required_document_types
  FOR INSERT
  WITH CHECK (public.is_leadership());

-- Leadership can update
CREATE POLICY "leadership_update_required_document_types"
  ON public.required_document_types
  FOR UPDATE
  USING (public.is_leadership());

-- Leadership can delete (soft-delete via is_active is preferred, but allow hard delete for cleanup)
CREATE POLICY "leadership_delete_required_document_types"
  ON public.required_document_types
  FOR DELETE
  USING (public.is_leadership());

-- ============================================================================
-- SEED DATA
-- ============================================================================

INSERT INTO public.required_document_types (name, description, sort_order)
VALUES
  ('Signed contract',    'Contrato individual de trabajo firmado',                          1),
  ('INE / ID',           'Identificación oficial vigente (INE, pasaporte, o cédula)',       2),
  ('Proof of address',   'Comprobante de domicilio (no mayor a 3 meses)',                   3),
  ('RFC certificate',    'Constancia de situación fiscal del SAT',                          4)
ON CONFLICT (name) DO NOTHING;
