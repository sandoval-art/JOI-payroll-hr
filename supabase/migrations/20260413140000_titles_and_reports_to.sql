-- ============================================================================
-- Org hierarchy: 5 titles (owner/admin/manager/team_lead/agent) + reports_to
-- ============================================================================
-- Title is stored on `employees` and is the single source of truth for both
-- job title AND permission level. `user_profiles.employee_id` joins from auth
-- users to their employee row, so useAuth can read title from there.
--
-- We keep user_profiles.role around (don't drop) for backward compat with any
-- code still reading it. The app code will switch to reading title.
-- ============================================================================

-- 1. Add title to employees
alter table public.employees
  add column if not exists title text not null default 'agent'
    check (title in ('owner', 'admin', 'manager', 'team_lead', 'agent'));

-- 2. Add reports_to (manager/team_lead they report to)
alter table public.employees
  add column if not exists reports_to uuid references public.employees(id) on delete set null;

create index if not exists idx_employees_reports_to on public.employees(reports_to);
create index if not exists idx_employees_title on public.employees(title);

-- 3. Backfill known titles by name match (best effort — won't error if name missing)
-- NOTE: Owner is seeded by auth email (not name), see block below. The name
-- "Daniel Sandoval" belongs to a test employee account, not the real owner.
update public.employees set title = 'admin'     where full_name ilike 'Paty Rodriguez%';
update public.employees set title = 'manager'   where full_name ilike 'Joe Renteria%';
update public.employees set title = 'team_lead' where full_name ilike 'Wendy%'
                                                  or full_name ilike 'Ruben Curiel%'
                                                  or full_name ilike 'Javier Caballero%';
-- Everyone else stays 'agent' by default.

-- 3b. Owner: match by auth email, not name (test accounts may share a name)
do $$
declare
  owner_auth_id uuid;
  owner_emp_id uuid;
begin
  select id into owner_auth_id from auth.users
    where email = 'diomedes.sandoval@justoutsource.it' limit 1;
  if owner_auth_id is null then return; end if;

  select employee_id into owner_emp_id from public.user_profiles
    where id = owner_auth_id limit 1;
  if owner_emp_id is null then return; end if;

  update public.employees set title = 'owner' where id = owner_emp_id;
end $$;

-- 4. Backfill reports_to for the team-lead reporting chain (best effort)
-- Team leads report up to Joe (manager). Agents report to their team lead by campaign.
do $$
declare
  joe_id uuid;
  wendy_id uuid;
  ruben_id uuid;
  javier_id uuid;
  hfb_id uuid;
  btc_id uuid;
  sloc_id uuid;
begin
  select id into joe_id    from public.employees where full_name ilike 'Joe Renteria%' limit 1;
  select id into wendy_id  from public.employees where full_name ilike 'Wendy%' limit 1;
  select id into ruben_id  from public.employees where full_name ilike 'Ruben Curiel%' limit 1;
  select id into javier_id from public.employees where full_name ilike 'Javier Caballero%' limit 1;

  select id into hfb_id  from public.clients where name ilike 'HFB%' limit 1;
  select id into btc_id  from public.clients where name in ('BTC', 'Big Think', 'Big Think Capital') limit 1;
  select id into sloc_id from public.clients where name ilike 'SLOC%' limit 1;

  -- Team leads report to Joe (if Joe exists)
  if joe_id is not null then
    update public.employees set reports_to = joe_id
      where title = 'team_lead' and reports_to is null;
  end if;

  -- HFB agents → Wendy
  if wendy_id is not null and hfb_id is not null then
    update public.employees set reports_to = wendy_id
      where client_id = hfb_id and title = 'agent' and reports_to is null;
  end if;

  -- BTC (Big Think) agents → Ruben
  if ruben_id is not null and btc_id is not null then
    update public.employees set reports_to = ruben_id
      where client_id = btc_id and title = 'agent' and reports_to is null;
  end if;

  -- SLOC agents → Javier (D can split SLOC weekday vs weekend later if needed)
  if javier_id is not null and sloc_id is not null then
    update public.employees set reports_to = javier_id
      where client_id = sloc_id and title = 'agent' and reports_to is null;
  end if;
end $$;

-- 5. Expand user_profiles.role check to accept new values too (back-compat).
-- We don't drop the column — old code still references it.
alter table public.user_profiles drop constraint if exists user_profiles_role_check;
alter table public.user_profiles add constraint user_profiles_role_check
  check (role in ('owner', 'admin', 'manager', 'team_lead', 'agent', 'employee'));

-- 6. Optional: keep user_profiles.role in sync with employees.title via trigger.
-- When a user_profile is created/updated with employee_id, copy title -> role.
create or replace function public.sync_user_profile_role()
returns trigger language plpgsql security definer as $$
begin
  if new.employee_id is not null then
    select title into new.role from public.employees where id = new.employee_id;
    if new.role is null then new.role := 'agent'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_user_profile_role on public.user_profiles;
create trigger trg_sync_user_profile_role
  before insert or update of employee_id on public.user_profiles
  for each row execute function public.sync_user_profile_role();

-- 7. One-time backfill: sync existing user_profiles to match employee titles
update public.user_profiles up
  set role = e.title
  from public.employees e
  where up.employee_id = e.id;

-- ============================================================================
-- 8. Shift settings audit log (who changed what shift, when)
-- ============================================================================
create table if not exists public.shift_settings_audit (
  id uuid primary key default uuid_generate_v4(),
  shift_setting_id uuid,                 -- nullable so deletes still log the row
  campaign_id uuid references public.clients(id) on delete set null,
  action text not null check (action in ('insert', 'update', 'delete')),
  changed_by uuid references auth.users(id) on delete set null,
  changed_by_email text,                 -- denormalized for easier reads
  changes jsonb,                         -- before/after diff for updates; full row for insert/delete
  changed_at timestamptz not null default now()
);

create index if not exists idx_shift_audit_campaign on public.shift_settings_audit(campaign_id, changed_at desc);
create index if not exists idx_shift_audit_shift on public.shift_settings_audit(shift_setting_id, changed_at desc);

create or replace function public.log_shift_settings_change()
returns trigger language plpgsql security definer as $$
declare
  actor_email text;
begin
  select email into actor_email from auth.users where id = auth.uid();

  if tg_op = 'INSERT' then
    insert into public.shift_settings_audit(shift_setting_id, campaign_id, action, changed_by, changed_by_email, changes)
      values (new.id, new.campaign_id, 'insert', auth.uid(), actor_email, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.shift_settings_audit(shift_setting_id, campaign_id, action, changed_by, changed_by_email, changes)
      values (new.id, new.campaign_id, 'update', auth.uid(), actor_email,
        jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new)));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.shift_settings_audit(shift_setting_id, campaign_id, action, changed_by, changed_by_email, changes)
      values (old.id, old.campaign_id, 'delete', auth.uid(), actor_email, to_jsonb(old));
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_shift_settings_audit on public.shift_settings;
create trigger trg_shift_settings_audit
  after insert or update or delete on public.shift_settings
  for each row execute function public.log_shift_settings_change();

alter table public.shift_settings_audit enable row level security;
create policy "Allow read for authenticated" on public.shift_settings_audit
  for select to authenticated using (true);
