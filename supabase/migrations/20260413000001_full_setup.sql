-- JOI Payroll and HR App - Full Database Setup
-- Migration: 20260413000001_full_setup
-- Description: Creates all existing payroll tables and new HR features

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================================
-- EXISTING TABLES (ordered by dependencies)
-- ============================================================================

-- clients (must come before employees, which references it)
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  prefix text not null unique,
  bill_to_name text,
  bill_to_address text,
  created_at timestamptz default now()
);

-- invoices
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  invoice_number text not null,
  week_number integer not null,
  week_start date not null,
  week_end date not null,
  due_date date not null,
  status text not null default 'draft',
  created_at timestamptz default now()
);

-- invoice_lines
create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  agent_name text not null,
  days_worked numeric(4,2) default 0,
  unit_price numeric(12,2) default 0,
  total numeric(12,2) default 0,
  spiffs numeric(12,2) default 0,
  total_price numeric(12,2) default 0
);

-- employees (references clients)
create table if not exists public.employees (
  id uuid primary key default uuid_generate_v4(),
  employee_id text unique not null,
  full_name text not null,
  client_id uuid references public.clients(id),
  shift_type text check (shift_type in ('L-J','L-V','V-D','V-L')),
  monthly_base_salary numeric(12,2) default 0,
  daily_discount_rate numeric(12,2) default 0,
  kpi_bonus_amount numeric(12,2) default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- payroll_periods
create table if not exists public.payroll_periods (
  id uuid primary key default uuid_generate_v4(),
  start_date date not null,
  end_date date not null,
  period_type text check (period_type in ('Q1','Q2')) not null,
  status text check (status in ('open','closed')) default 'open',
  created_at timestamptz default now()
);

-- payroll_records
create table if not exists public.payroll_records (
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

-- ============================================================================
-- NEW TABLES FOR HR FEATURES
-- ============================================================================

-- user_profiles - links Supabase auth users to roles
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  role text not null check (role in ('admin', 'manager', 'employee')),
  created_at timestamptz default now()
);

-- time_clock - clock in/out entries
create table if not exists public.time_clock (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  clock_in timestamptz not null,
  clock_out timestamptz,
  date date not null,
  total_hours numeric(5,2),
  is_late boolean default false,
  late_minutes integer default 0,
  created_at timestamptz default now()
);

-- time_off_requests - employee time-off submissions
create table if not exists public.time_off_requests (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text not null check (reason in ('vacation', 'sick', 'personal', 'other')),
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

-- eod_logs - end-of-day performance logs
create table if not exists public.eod_logs (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  date date not null,
  campaign_id uuid not null references public.clients(id),
  metrics jsonb not null,
  notes text,
  created_at timestamptz default now(),
  unique(employee_id, date)
);

-- shift_settings - configurable shift times per campaign
create table if not exists public.shift_settings (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references public.clients(id) on delete cascade,
  shift_name text not null,
  start_time time not null,
  end_time time not null,
  grace_minutes integer default 10,
  days_of_week integer[],
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id) on delete set null
);

-- campaign_kpi_config - defines KPI fields per campaign
create table if not exists public.campaign_kpi_config (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references public.clients(id) on delete cascade,
  field_name text not null,
  field_label text not null,
  field_type text not null default 'number' check (field_type in ('number', 'boolean')),
  min_target numeric(10,2),
  display_order integer default 0,
  is_active boolean default true
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
alter table public.employees enable row level security;
alter table public.payroll_periods enable row level security;
alter table public.payroll_records enable row level security;
alter table public.clients enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.user_profiles enable row level security;
alter table public.time_clock enable row level security;
alter table public.time_off_requests enable row level security;
alter table public.eod_logs enable row level security;
alter table public.shift_settings enable row level security;
alter table public.campaign_kpi_config enable row level security;

-- Allow full access for authenticated users (will be tightened later)
create policy "Allow full access for authenticated" on public.employees
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Allow full access for authenticated" on public.payroll_periods
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Allow full access for authenticated" on public.payroll_records
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Allow full access for authenticated" on public.clients
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Allow full access for authenticated" on public.invoices
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Allow full access for authenticated" on public.invoice_lines
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Allow full access for authenticated" on public.user_profiles
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Allow full access for authenticated" on public.time_clock
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Allow full access for authenticated" on public.time_off_requests
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Allow full access for authenticated" on public.eod_logs
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Allow full access for authenticated" on public.shift_settings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Allow full access for authenticated" on public.campaign_kpi_config
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================================
-- SEED DATA: CLIENTS
-- ============================================================================

insert into public.clients (name, prefix, bill_to_name, bill_to_address)
values
  ('Torro', 'JOI', 'Torro Inc.', '123 Business Ave, Suite 100, San Francisco, CA 94105'),
  ('BTC', 'BTC', 'BTC Financial', '456 Finance Blvd, Suite 200, New York, NY 10001'),
  ('HFB', 'HFB', 'HFB Tech Solutions', '789 Tech Drive, Suite 300, Austin, TX 78701'),
  ('Scoop', 'SCO', 'Scoop Services Inc.', '321 Service Lane, Suite 400, Seattle, WA 98101')
on conflict (prefix) do nothing;

-- ============================================================================
-- SEED DATA: SHIFT SETTINGS
-- ============================================================================

-- Get client IDs for seeding
with client_ids as (
  select id, prefix from public.clients
)
insert into public.shift_settings (campaign_id, shift_name, start_time, end_time, grace_minutes, days_of_week)
select
  c.id,
  shift_data.shift_name,
  shift_data.start_time,
  shift_data.end_time,
  shift_data.grace_minutes,
  shift_data.days_of_week
from client_ids c
cross join (
  -- Torro weekday: Mon-Thu 8:00-17:00
  values
    ('JOI', 'Weekday', '08:00'::time, '17:00'::time, 10, array[1,2,3,4]),
    -- Torro MCA weekday: Mon-Fri 9:00-18:00
    ('JOI', 'Weekday MCA', '09:00'::time, '18:00'::time, 10, array[1,2,3,4,5]),
    -- BTC weekday: Mon-Fri 8:00-17:00
    ('BTC', 'Weekday', '08:00'::time, '17:00'::time, 10, array[1,2,3,4,5]),
    -- HFBTECH weekday: Mon-Fri 8:00-17:00
    ('HFB', 'Weekday', '08:00'::time, '17:00'::time, 10, array[1,2,3,4,5]),
    -- Scoop weekday: Mon-Fri 8:00-17:00
    ('SCO', 'Weekday', '08:00'::time, '17:00'::time, 10, array[1,2,3,4,5]),
    -- Weekend (all campaigns): Fri-Sun 8:00-20:00
    ('JOI', 'Weekend', '08:00'::time, '20:00'::time, 10, array[5,6,0]),
    ('BTC', 'Weekend', '08:00'::time, '20:00'::time, 10, array[5,6,0]),
    ('HFB', 'Weekend', '08:00'::time, '20:00'::time, 10, array[5,6,0]),
    ('SCO', 'Weekend', '08:00'::time, '20:00'::time, 10, array[5,6,0])
) as shift_data(prefix, shift_name, start_time, end_time, grace_minutes, days_of_week)
where c.prefix = shift_data.prefix
on conflict do nothing;

-- ============================================================================
-- SEED DATA: CAMPAIGN KPI CONFIG
-- ============================================================================

with client_ids as (
  select id, prefix from public.clients
)
insert into public.campaign_kpi_config (campaign_id, field_name, field_label, field_type, min_target, display_order, is_active)
select
  c.id,
  kpi_data.field_name,
  kpi_data.field_label,
  kpi_data.field_type,
  kpi_data.min_target,
  kpi_data.display_order,
  true
from client_ids c
cross join (
  -- Torro SLOC
  values
    ('JOI', 'credit_pulls', 'Credit Pulls', 'number', 7::numeric, 1),
    ('JOI', 'approval_calls', 'Approval Calls', 'number', NULL::numeric, 2),
    ('JOI', 'scheduled_with_closers', 'Scheduled with Closers', 'number', NULL::numeric, 3),
    -- Torro MCA
    ('JOI', 'packages_returned', 'Packages Returned', 'number', 7::numeric, 4),
    ('JOI', 'calls_made', 'Calls Made', 'number', 300::numeric, 5),
    -- BTC
    ('BTC', 'transfers_completed', 'Transfers Completed', 'number', 10::numeric, 1),
    ('BTC', 'calls_made', 'Calls Made', 'number', 300::numeric, 2),
    -- Scoop
    ('SCO', 'reviews_completed', 'Reviews Completed', 'number', NULL::numeric, 1),
    ('SCO', 'support_tickets', 'Support Tickets', 'number', NULL::numeric, 2),
    ('SCO', 'reactivations', 'Reactivations', 'number', NULL::numeric, 3),
    -- HFBTECH
    ('HFB', 'sets_completed', 'Sets Completed', 'number', 4::numeric, 1),
    ('HFB', 'calls_made', 'Calls Made', 'number', 90::numeric, 2)
) as kpi_data(prefix, field_name, field_label, field_type, min_target, display_order)
where c.prefix = kpi_data.prefix
on conflict do nothing;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

create index if not exists idx_employees_client_id on public.employees(client_id);
create index if not exists idx_employees_is_active on public.employees(is_active);
create index if not exists idx_payroll_records_employee_id on public.payroll_records(employee_id);
create index if not exists idx_payroll_records_period_id on public.payroll_records(period_id);
create index if not exists idx_invoices_client_id on public.invoices(client_id);
create index if not exists idx_invoice_lines_invoice_id on public.invoice_lines(invoice_id);
create index if not exists idx_user_profiles_employee_id on public.user_profiles(employee_id);
create index if not exists idx_time_clock_employee_id on public.time_clock(employee_id);
create index if not exists idx_time_clock_date on public.time_clock(date);
create index if not exists idx_time_off_requests_employee_id on public.time_off_requests(employee_id);
create index if not exists idx_time_off_requests_status on public.time_off_requests(status);
create index if not exists idx_eod_logs_employee_id on public.eod_logs(employee_id);
create index if not exists idx_eod_logs_date on public.eod_logs(date);
create index if not exists idx_eod_logs_campaign_id on public.eod_logs(campaign_id);
create index if not exists idx_shift_settings_campaign_id on public.shift_settings(campaign_id);
create index if not exists idx_campaign_kpi_config_campaign_id on public.campaign_kpi_config(campaign_id);
