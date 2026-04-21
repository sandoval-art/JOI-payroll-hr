-- A3a: Server-side clock-in compliance trigger.
-- Rejects time_clock inserts for employees past their compliance_grace_until
-- who still have unapproved or missing required documents.
-- Closes the UI-only bypass gap flagged in docs/hr-roadmap.md § A3a.

BEGIN;

-- ── Trigger function ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_clock_in_compliance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_grace date;
  v_missing_count int;
BEGIN
  -- 1. Fetch the employee's compliance grace deadline
  SELECT compliance_grace_until
    INTO v_grace
    FROM public.employees
   WHERE id = NEW.employee_id;

  -- 2. If NULL or still in grace period → allow
  IF v_grace IS NULL OR v_grace >= CURRENT_DATE THEN
    RETURN NEW;
  END IF;

  -- 3. Past grace — check for any active required doc type that is NOT approved
  SELECT count(*)
    INTO v_missing_count
    FROM public.required_document_types rdt
   WHERE rdt.is_active = true
     AND NOT EXISTS (
       SELECT 1
         FROM public.employee_documents ed
        WHERE ed.employee_id = NEW.employee_id
          AND ed.document_type_id = rdt.id
          AND ed.status = 'approved'
     );

  IF v_missing_count > 0 THEN
    RAISE EXCEPTION
      'Clock-in blocked: employee % is past compliance grace period and has unapproved or missing required documents.',
      NEW.employee_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_clock_in_compliance() IS
  'BEFORE INSERT trigger on time_clock. Rejects clock-in for employees past '
  'compliance_grace_until with unapproved/missing required documents. '
  'See docs/hr-roadmap.md § A3a.';

-- ── Trigger ─────────────────────────────────────────────────────────
CREATE TRIGGER enforce_clock_in_compliance_trigger
  BEFORE INSERT ON public.time_clock
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_clock_in_compliance();

COMMIT;
