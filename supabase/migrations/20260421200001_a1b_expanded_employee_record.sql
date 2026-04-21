-- A1b: Expanded employee record — departments catalog + 9 new columns on employees.
-- Sequel to A1 RLS hardening (PR #32). New columns are sensitive (personal/banking/ID)
-- and intentionally excluded from employees_no_pay view.

BEGIN;

-- ── 1. Departments catalog table ────────────────────────────────────────

CREATE TABLE public.departments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL UNIQUE,
  is_active  boolean     NOT NULL DEFAULT true,
  sort_order integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Reuse existing set_updated_at() trigger function
CREATE TRIGGER set_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_departments"
  ON public.departments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "leadership_all_departments"
  ON public.departments FOR ALL
  TO authenticated
  USING (public.is_leadership())
  WITH CHECK (public.is_leadership());

-- Seed
INSERT INTO public.departments (name, sort_order) VALUES
  ('Credit puller', 1),
  ('MCA', 2),
  ('Transfers', 3),
  ('Tech Support', 4),
  ('Data Entry', 5),
  ('Designer', 6),
  ('SEO specialist', 7),
  ('Sales Agent', 8),
  ('Sales CS', 9),
  ('Underwriting', 10),
  ('Decline', 11)
ON CONFLICT (name) DO NOTHING;

-- ── 2. New columns on employees ─────────────────────────────────────────

ALTER TABLE public.employees
  ADD COLUMN work_name         text,
  ADD COLUMN personal_email    text,
  ADD COLUMN hire_date         date,
  ADD COLUMN emergency_contact text,
  ADD COLUMN bank_name         text,
  ADD COLUMN date_of_birth     date,
  ADD COLUMN marital_status    text,
  ADD COLUMN nss               text,
  ADD COLUMN last_worked_day   date,
  ADD COLUMN department_id     uuid REFERENCES public.departments(id);

COMMENT ON COLUMN public.employees.work_name         IS 'Preferred name used at work (may differ from full_name).';
COMMENT ON COLUMN public.employees.personal_email    IS 'Personal email (not the auth/login email).';
COMMENT ON COLUMN public.employees.hire_date         IS 'Date the employee was hired.';
COMMENT ON COLUMN public.employees.emergency_contact IS 'Free-text: name + relationship + phone.';
COMMENT ON COLUMN public.employees.bank_name         IS 'Name of the bank (complements bank_clabe).';
COMMENT ON COLUMN public.employees.date_of_birth     IS 'Date of birth.';
COMMENT ON COLUMN public.employees.marital_status    IS 'Free-text to cover edge cases (e.g. "Casado (Separado)").';
COMMENT ON COLUMN public.employees.nss               IS 'Mexican IMSS number (10-11 digits).';
COMMENT ON COLUMN public.employees.last_worked_day   IS 'Last day the employee worked (for terminations).';
COMMENT ON COLUMN public.employees.department_id     IS 'FK to departments. Nullable now; NOT NULL in a follow-up after backfill.';

COMMIT;
