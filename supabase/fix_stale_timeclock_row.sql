-- One-off cleanup for stale same-minute clock-in/out rows (timezone bug 2026-04-14)
-- Safe to run: only deletes rows where clock_in and clock_out are the same minute
-- AND total_hours is 0 (or null) — i.e. rows that never represented real work.

-- Preview first
select id, employee_id, date, clock_in, clock_out, total_hours
from public.time_clock
where clock_out is not null
  and total_hours < 0.02
  and extract(epoch from (clock_out - clock_in)) < 120;

-- If the preview looks right, delete:
-- delete from public.time_clock
-- where clock_out is not null
--   and total_hours < 0.02
--   and extract(epoch from (clock_out - clock_in)) < 120;
