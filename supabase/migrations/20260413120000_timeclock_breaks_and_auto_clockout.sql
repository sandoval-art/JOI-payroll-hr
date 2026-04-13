-- Phase A: break tracking + auto clock-out + EOD gate on time_clock
-- Adds columns to support: 60-min unpaid lunch, 2x 15-min paid breaks,
-- scheduled shift-end (for auto clock-out), and EOD-completed gate.

alter table public.time_clock
  add column if not exists lunch_start timestamptz,
  add column if not exists lunch_end timestamptz,
  add column if not exists break1_start timestamptz,
  add column if not exists break1_end timestamptz,
  add column if not exists break2_start timestamptz,
  add column if not exists break2_end timestamptz,
  add column if not exists shift_end_expected timestamptz,
  add column if not exists auto_clocked_out boolean not null default false,
  add column if not exists eod_completed boolean not null default false;

comment on column public.time_clock.lunch_start is 'Start of unpaid 60-min lunch break';
comment on column public.time_clock.lunch_end is 'End of unpaid 60-min lunch break (deducted from total_hours)';
comment on column public.time_clock.break1_start is 'Start of first paid 15-min break';
comment on column public.time_clock.break1_end is 'End of first paid 15-min break';
comment on column public.time_clock.break2_start is 'Start of second paid 15-min break';
comment on column public.time_clock.break2_end is 'End of second paid 15-min break';
comment on column public.time_clock.shift_end_expected is 'Scheduled shift end set at clock-in from shift_settings; used by auto clock-out job';
comment on column public.time_clock.auto_clocked_out is 'True when the system auto-closed this entry at scheduled shift end';
comment on column public.time_clock.eod_completed is 'True once the agent submitted the EOD form for this entry; required to clock out manually';

-- Index for the auto-clockout job: find open entries whose scheduled end has passed
create index if not exists idx_time_clock_open_past_shift
  on public.time_clock (shift_end_expected)
  where clock_out is null;
