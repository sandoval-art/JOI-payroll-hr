-- SLOC shift settings defaults
-- You mentioned weekend works 12hr × 3 days. Defaulting weekend to Fri-Sun
-- (common pattern). Edit anything wrong via /settings/shifts.

-- Make sure SLOC exists
insert into public.clients (name, prefix)
select 'SLOC', 'SLOC'
where not exists (select 1 from public.clients where name ilike 'SLOC');

-- SLOC Weekday: 9-6 Mon-Thu (4 days, since the weekend takes Fri-Sun)
with c as (select id from public.clients where name ilike 'SLOC' limit 1)
insert into public.shift_settings (campaign_id, shift_name, start_time, end_time, grace_minutes, days_of_week)
select c.id, 'Weekday', '09:00', '18:00', 10, ARRAY[1,2,3,4]
from c
where not exists (
  select 1 from public.shift_settings ss
  where ss.campaign_id = c.id and ss.shift_name = 'Weekday'
);

-- SLOC Weekend: 12hr Fri-Sun
with c as (select id from public.clients where name ilike 'SLOC' limit 1)
insert into public.shift_settings (campaign_id, shift_name, start_time, end_time, grace_minutes, days_of_week)
select c.id, 'Weekend', '07:00', '19:00', 10, ARRAY[5,6,7]
from c
where not exists (
  select 1 from public.shift_settings ss
  where ss.campaign_id = c.id and ss.shift_name = 'Weekend'
);

-- Sanity check
select c.name as campaign, ss.shift_name, ss.start_time, ss.end_time, ss.grace_minutes, ss.days_of_week
from public.clients c
left join public.shift_settings ss on ss.campaign_id = c.id
where c.name ilike 'SLOC'
order by ss.shift_name;
