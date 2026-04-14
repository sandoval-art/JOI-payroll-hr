-- ============================================================================
-- Correct Daniel Sandoval test account back to 'agent' and set the real
-- owner title on whoever owns diomedes.sandoval@justoutsource.it.
-- ============================================================================
-- Context: the initial migration matched by full_name LIKE 'Daniel Sandoval%'
-- which incorrectly elevated the test employee account. The real owner login
-- is diomedes.sandoval@justoutsource.it. Run this once to fix.

-- 1. Reset the test account back to agent
update public.employees
set title = 'agent'
where full_name ilike 'Daniel Sandoval%';

-- 2. Find the auth user for the real owner and tag their linked employee as owner
--    (works even if Diomedes hasn't been added as an employee yet — just skips silently)
do $$
declare
  owner_auth_id uuid;
  owner_emp_id uuid;
begin
  select id into owner_auth_id from auth.users
    where email = 'diomedes.sandoval@justoutsource.it' limit 1;

  if owner_auth_id is null then
    raise notice 'No auth user yet for diomedes.sandoval@justoutsource.it — create that account first, then re-run.';
    return;
  end if;

  select employee_id into owner_emp_id from public.user_profiles
    where id = owner_auth_id limit 1;

  if owner_emp_id is null then
    raise notice 'Auth user exists but has no linked employee row — add them as an employee first, then re-run.';
    return;
  end if;

  update public.employees set title = 'owner' where id = owner_emp_id;
  raise notice 'Owner title set on employee %.', owner_emp_id;
end $$;
