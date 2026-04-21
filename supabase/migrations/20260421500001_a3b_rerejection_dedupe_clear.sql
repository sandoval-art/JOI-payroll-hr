-- A3b: Clear rejection dedupe row when employee_documents.status transitions
-- away from 'rejected'. Fixes the silent bug where re-uploading a doc and
-- getting it rejected a second time does not fire a new compliance email,
-- because the dedupe key (employee_id, 'rejection', related_document_id)
-- still has a row from the first rejection.
--
-- Design: delete-on-transition was chosen over extending the dedupe key with
-- reviewed_at — the key-extension approach was rejected because it accumulates
-- stale rows in the dedupe table and makes the UNIQUE constraint harder to
-- reason about.

BEGIN;

-- ── Trigger function ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clear_compliance_dedupe_on_rerejection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.compliance_notifications_sent
   WHERE related_document_id = NEW.id;

  RETURN NULL; -- AFTER trigger, return value ignored
END;
$$;

COMMENT ON FUNCTION public.clear_compliance_dedupe_on_rerejection() IS
  'AFTER UPDATE trigger on employee_documents. Clears the rejection dedupe '
  'row in compliance_notifications_sent when a document status transitions '
  'away from rejected (e.g. agent re-uploads → pending_review). '
  'See docs/hr-roadmap.md § A3b.';

-- ── Trigger ─────────────────────────────────────────────────────────
CREATE TRIGGER clear_compliance_dedupe_on_rerejection_trigger
  AFTER UPDATE OF status ON public.employee_documents
  FOR EACH ROW
  WHEN (OLD.status = 'rejected' AND NEW.status IS DISTINCT FROM 'rejected')
  EXECUTE FUNCTION public.clear_compliance_dedupe_on_rerejection();

COMMIT;
