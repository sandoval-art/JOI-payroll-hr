-- Test seed: create employee "Daniel Sandoval" and link to the auth user
-- with email sandoval.028@gmail.com so we can exercise the employee timeclock UI.
--
-- Defaults (swap as needed):
--   campaign        : SLOC
--   shift_type      : L-V  (Mon-Fri weekday)
--   monthly_base    : 12000 MXN
--   daily_discount  : 400 MXN
--   kpi_bonus       : 1500 MXN
--   role            : employee  (so you see the employee-only sidebar)

-- 1) Ensure SLOC exists; insert if missing (no-op if already there)
insert into public.clients (name, prefix)
select 'SLOC', 'SLOC'
where not exists (select 1 from public.clients where name ilike 'SLOC');

-- 2) Insert the employee row (idempotent on employee_id)
with sloc as (
  select id from public.clients where name ilike 'SLOC' limit 1
)
insert into public.employees (
  employee_id, full_name, client_id, shift_type,
  monthly_base_salary, daily_discount_rate, kpi_bonus_amount, is_active
)
select 'JOI-DS-001', 'Daniel Sandoval', sloc.id, 'L-V',
       12000, 400, 1500, true
from sloc
on conflict (employee_id) do update
  set full_name = excluded.full_name,
      client_id = excluded.client_id,
      shift_type = excluded.shift_type,
      monthly_base_salary = excluded.monthly_base_salary,
      daily_discount_rate = excluded.daily_discount_rate,
      kpi_bonus_amount = excluded.kpi_bonus_amount,
      is_active = true;

-- 3) Link the auth user (sandoval.028@gmail.com) to this employee, role = employee
with auth_user as (
  select id from auth.users where lower(email) = 'sandoval.028@gmail.com' limit 1
),
emp as (
  select id from public.employees where employee_id = 'JOI-DS-001' limit 1
)
insert into public.user_profiles (id, employee_id, role)
select au.id, emp.id, 'employee'
from auth_user au, emp
on conflict (id) do update
  set employee_id = excluded.employee_id,
      role = excluded.role;

-- 4) Sanity check — should return one row
select
  up.id as auth_user_id,
  au.email,
  up.role,
  e.employee_id,
  e.full_name,
  c.name as campaign,
  e.shift_type
from public.user_profiles up
join auth.users au on au.id = up.id
join public.employees e on e.id = up.employee_id
left join public.clients c on c.id = e.client_id
where lower(au.email) = 'sandoval.028@gmail.com';
