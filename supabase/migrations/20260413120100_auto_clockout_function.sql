-- Phase A.1: Auto clock-out for overdue open shifts
-- A function + pg_cron schedule that closes any time_clock row whose
-- shift_end_expected has passed (with a 30-min grace) and is still open.
--
-- Behavior on auto-close:
--   * clock_out      = shift_end_expected (NOT now() — we don't pay past schedule)
--   * total_hours    = (shift_end_expected - clock_in) / 60 minus actual lunch taken
--   * auto_clocked_out = true
--
-- If the agent never started lunch but the shift is > 5h, we do NOT deduct a
-- phantom lunch — that's a manager review case (they'll see the missing lunch
-- in the history). Keeps logic predictable.

create or replace function public.auto_clockout_overdue()
returns table (closed_id uuid, employee_id uuid, scheduled_end timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  grace_min int := 30; -- close 30 min after scheduled end
begin
  return query
  with to_close as (
    select
      tc.id,
      tc.employee_id,
      tc.clock_in,
      tc.shift_end_expected,
      coalesce(
        extract(epoch from (tc.lunch_end - tc.lunch_start)) / 60.0,
        0
      ) as lunch_minutes
    from public.time_clock tc
    where tc.clock_out is null
      and tc.shift_end_expected is not null
      and tc.shift_end_expected < (now() - (grace_min || ' minutes')::interval)
  ),
  updated as (
    update public.time_clock tc
       set clock_out = c.shift_end_expected,
           auto_clocked_out = true,
           total_hours = round(
             (extract(epoch from (c.shift_end_expected - c.clock_in)) / 3600.0
              - (c.lunch_minutes / 60.0))::numeric,
             2
           )
      from to_close c
     where tc.id = c.id
    returning tc.id, tc.employee_id, tc.shift_end_expected
  )
  select id, employee_id, shift_end_expected from updated;
end;
$$;

comment on function public.auto_clockout_overdue is
  'Closes open time_clock entries whose shift_end_expected passed > 30 min ago. Sets auto_clocked_out=true. Returns closed row info for downstream notifiers.';

-- ============================================================================
-- pg_cron schedule (every 5 minutes)
-- ============================================================================
-- Requires the pg_cron extension. If it is not enabled, run this first in the
-- Supabase dashboard:  Database -> Extensions -> enable "pg_cron"
-- Then this CREATE EXTENSION line is a no-op:
create extension if not exists pg_cron with schema extensions;

-- Unschedule any prior version, then schedule fresh.
do $$
declare
  job_id bigint;
begin
  select jobid into job_id from cron.job where jobname = 'auto_clockout_overdue_every_5min';
  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;
end $$;

select cron.schedule(
  'auto_clockout_overdue_every_5min',
  '*/5 * * * *',
  $$select public.auto_clockout_overdue();$$
);
