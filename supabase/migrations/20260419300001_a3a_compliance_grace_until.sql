-- A3a: Compliance enforcement — per-employee grace window
-- NULL = no enforcement (default). Date in future = grace active. Date in past = locked if non-compliant.
alter table public.employees
  add column if not exists compliance_grace_until date;

comment on column public.employees.compliance_grace_until is
  'Compliance grace deadline. NULL = no enforcement. Past date + missing docs = clock-in locked.';
