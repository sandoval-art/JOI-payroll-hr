
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. employees
create table public.employees (
  id uuid primary key default uuid_generate_v4(),
  employee_id text unique not null,
  full_name text not null,
  shift_type text check (shift_type in ('L-J','L-V','V-D','V-L')),
  monthly_base_salary numeric(12,2) default 0,
  daily_discount_rate numeric(12,2) default 0,
  kpi_bonus_amount numeric(12,2) default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 2. payroll_periods
create table public.payroll_periods (
  id uuid primary key default uuid_generate_v4(),
  start_date date not null,
  end_date date not null,
  period_type text check (period_type in ('Q1','Q2')) not null,
  status text check (status in ('open','closed')) default 'open',
  created_at timestamptz default now()
);

-- 3. payroll_records
create table public.payroll_records (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid references public.employees(id) on delete cascade not null,
  period_id uuid references public.payroll_periods(id) not null,
  days_absent integer default 0,
  extra_days_count integer default 0,
  kpi_achieved boolean default false,
  sunday_premium_applied boolean default false,
  holiday_worked boolean default false,
  additional_bonuses numeric(12,2) default 0,
  calculated_net_pay numeric(12,2),
  updated_at timestamptz default now(),
  unique(employee_id, period_id)
);

-- RLS policies for authenticated users
create policy "Allow full access to employees" on public.employees
  for all to authenticated using (true) with check (true);

create policy "Allow full access to payroll_periods" on public.payroll_periods
  for all to authenticated using (true) with check (true);

create policy "Allow full access to payroll_records" on public.payroll_records
  for all to authenticated using (true) with check (true);

-- Temporary anon policies for development (remove after implementing auth)
create policy "Anon access to employees" on public.employees
  for all to anon using (true) with check (true);

create policy "Anon access to payroll_periods" on public.payroll_periods
  for all to anon using (true) with check (true);

create policy "Anon access to payroll_records" on public.payroll_records
  for all to anon using (true) with check (true);
