-- MT Phase 5 — Per-org employee ID prefix
--
-- 1. Adds employee_id_prefix column to organizations (NOT NULL, default 'JOI').
-- 2. Backfills JOI org explicitly.
-- 3. Updates assign_employee_id() trigger to look up the prefix per org.
--    Previously hardcoded 'JOI-'; now reads organizations.employee_id_prefix.
--    Falls back to 'EMP' for rows with NULL organization_id (edge case only).

-- 1. Add prefix column to organizations
ALTER TABLE public.organizations
  ADD COLUMN employee_id_prefix text NOT NULL DEFAULT 'JOI'
  CHECK (employee_id_prefix ~ '^[A-Z0-9]{2,10}$');

-- 2. Backfill JOI org explicitly (already covered by DEFAULT, but be explicit)
UPDATE public.organizations SET employee_id_prefix = 'JOI' WHERE slug = 'joi';

-- 3. Update the trigger function to look up the prefix from organizations
CREATE OR REPLACE FUNCTION public.assign_employee_id()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_prefix text;
BEGIN
  IF NEW.employee_id IS NULL OR NEW.employee_id = '' THEN
    SELECT employee_id_prefix INTO v_prefix
    FROM public.organizations
    WHERE id = NEW.organization_id;

    NEW.employee_id :=
      COALESCE(v_prefix, 'EMP') || '-' ||
      lpad(nextval('public.employee_id_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
