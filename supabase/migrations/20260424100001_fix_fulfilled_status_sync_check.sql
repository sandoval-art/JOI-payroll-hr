-- Fix: The hr_document_requests_fulfilled_status_sync CHECK constraint was too
-- strict. Original Phase 1 (PR #42) + F1 extension (PR #51) both enforced:
--     (status = 'fulfilled') IFF (any fulfilled_*_id IS NOT NULL)
-- which is a biconditional. That forbade the legitimate intermediate state
-- (status='in_progress', fulfilled_*_id=xxx) that hr_create_finalization_draft
-- creates on first save — the RPC simultaneously sets fulfilled_renuncia_id
-- and transitions status pending→in_progress.
--
-- Also forbade the "Empezar a redactar clicked but editor not yet opened" state
-- where status='in_progress' with all fulfilled_*=NULL.
--
-- Surfaced 2026-04-23 when D tried to save a renuncia draft — PostgREST
-- returned 23514 check constraint violation. Same bug would have hit carta/acta
-- but was never exercised end-to-end as a non-owner user until now.
--
-- Fix: relaxed the CHECK to constrain only the meaningful invariants:
--   pending    → must have no draft yet (all fulfilled_*=NULL)
--   fulfilled  → must have a draft (at least one fulfilled_* IS NOT NULL)
--   in_progress/canceled/downgraded → unconstrained (legitimate intermediate or
--   terminal-non-fulfilled states)
--
-- Applied via Cowork MCP 2026-04-24; this file commits for audit trail.

ALTER TABLE public.hr_document_requests
  DROP CONSTRAINT hr_document_requests_fulfilled_status_sync;

ALTER TABLE public.hr_document_requests
  ADD CONSTRAINT hr_document_requests_fulfilled_status_sync CHECK (
    (status = 'pending'
      AND fulfilled_carta_id IS NULL
      AND fulfilled_acta_id IS NULL
      AND fulfilled_renuncia_id IS NULL)
    OR
    (status = 'fulfilled'
      AND (fulfilled_carta_id IS NOT NULL
           OR fulfilled_acta_id IS NOT NULL
           OR fulfilled_renuncia_id IS NOT NULL))
    OR
    (status IN ('in_progress', 'canceled', 'downgraded'))
  );
