-- B-05: Clear grace-driven dedupe rows when compliance_grace_until changes.
-- Fixes the silent bug where extending or removing an employee's grace deadline
-- does not cause reminder/lock emails to re-fire at the new countdown, because
-- rows from the old countdown still block the dedupe key.
--
-- Mirrors the A3b pattern (clear_compliance_dedupe_on_rerejection_trigger).
-- Only clears grace-driven notification types; 'rejection' rows are per-document
-- and unrelated to grace changes.

BEGIN;

-- ── Trigger function ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clear_compliance_dedupe_on_grace_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.compliance_notifications_sent
   WHERE employee_id = NEW.id
     AND notification_type IN ('reminder_7d', 'reminder_3d', 'reminder_1d', 'lock');

  RETURN NULL; -- AFTER trigger, return value ignored
END;
$$;

COMMENT ON FUNCTION public.clear_compliance_dedupe_on_grace_change() IS
  'AFTER UPDATE trigger on employees. Clears grace-driven dedupe rows '
  '(reminder_7d, reminder_3d, reminder_1d, lock) in compliance_notifications_sent '
  'when compliance_grace_until changes. Does NOT clear rejection rows. '
  'See docs/hr-roadmap.md § old-B-05.';

-- ── Trigger ─────────────────────────────────────────────────────────
CREATE TRIGGER clear_compliance_dedupe_on_grace_change_trigger
  AFTER UPDATE OF compliance_grace_until ON public.employees
  FOR EACH ROW
  WHEN (OLD.compliance_grace_until IS DISTINCT FROM NEW.compliance_grace_until)
  EXECUTE FUNCTION public.clear_compliance_dedupe_on_grace_change();

COMMIT;
