-- 1. Auto-generate employee_id via sequence + trigger
create sequence if not exists public.employee_id_seq start 1;

select setval('public.employee_id_seq', greatest(
  coalesce((select max(substring(employee_id from 'JOI-(\d+)')::int) from employees where employee_id ~ '^JOI-\d+$'), 0),
  coalesce((select max(substring(employee_id from 'EMP-(\d+)')::int) from employees where employee_id ~ '^EMP-\d+$'), 0),
  1
));

create or replace function public.assign_employee_id()
returns trigger language plpgsql as $$
begin
  if new.employee_id is null or new.employee_id = '' then
    new.employee_id := 'JOI-' || lpad(nextval('public.employee_id_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_employee_id on public.employees;
create trigger trg_assign_employee_id
before insert on public.employees
for each row execute function public.assign_employee_id();

-- 2. Mexican holidays table
create table if not exists public.mexican_holidays (
  date date primary key,
  name text not null
);

alter table public.mexican_holidays enable row level security;
create policy "Allow read for authenticated" on public.mexican_holidays
  for select using (auth.role() = 'authenticated');

insert into public.mexican_holidays (date, name) values
  ('2026-01-01', 'Ano Nuevo'),
  ('2026-02-02', 'Dia de la Constitucion'),
  ('2026-03-16', 'Natalicio de Benito Juarez'),
  ('2026-05-01', 'Dia del Trabajo'),
  ('2026-09-16', 'Dia de la Independencia'),
  ('2026-11-16', 'Dia de la Revolucion'),
  ('2026-12-25', 'Navidad')
on conflict (date) do nothing;

-- 3. Add overrides_json to payroll_records
alter table public.payroll_records
  add column if not exists overrides_json jsonb default '{}'::jsonb;
