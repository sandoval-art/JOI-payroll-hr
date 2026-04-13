-- Initial shift settings defaults — edit anytime via the Shift Settings admin page.
-- Using WINTER hours as starting point. Switch via UI when DST hits.
-- days_of_week: ISO convention 1=Mon ... 7=Sun

-- Make sure the campaigns exist as clients
insert into public.clients (name, prefix)
select 'Big Think', 'BT' where not exists (select 1 from public.clients where name ilike 'Big Think');

insert into public.clients (name, prefix)
select 'HFB', 'HFB' where not exists (select 1 from public.clients where name ilike 'HFB');

insert into public.clients (name, prefix)
select 'Torro/Scoop', 'TRS' where not exists (select 1 from public.clients where name ilike 'Torro%');

-- Big Think: Winter 8-5, Mon-Fri, 10 min grace
with c as (select id from public.clients where name ilike 'Big Think' limit 1)
insert into public.shift_settings (campaign_id, shift_name, start_time, end_time, grace_minutes, days_of_week)
select c.id, 'Standard', '08:00', '17:00', 10, ARRAY[1,2,3,4,5]
from c
where not exists (select 1 from public.shift_settings ss where ss.campaign_id = c.id);

-- HFB: Winter 8-6, Mon-Fri, 10 min grace
with c as (select id from public.clients where name ilike 'HFB' limit 1)
insert into public.shift_settings (campaign_id, shift_name, start_time, end_time, grace_minutes, days_of_week)
select c.id, 'Standard', '08:00', '18:00', 10, ARRAY[1,2,3,4,5]
from c
where not exists (select 1 from public.shift_settings ss where ss.campaign_id = c.id);

-- Torro/Scoop: Winter 9-6, Mon-Fri, 10 min grace
with c as (select id from public.clients where name ilike 'Torro%' limit 1)
insert into public.shift_settings (campaign_id, shift_name, start_time, end_time, grace_minutes, days_of_week)
select c.id, 'Standard', '09:00', '18:00', 10, ARRAY[1,2,3,4,5]
from c
where not exists (select 1 from public.shift_settings ss where ss.campaign_id = c.id);

-- Sanity check
select c.name as campaign, ss.shift_name, ss.start_time, ss.end_time, ss.grace_minutes, ss.days_of_week
from public.clients c
left join public.shift_settings ss on ss.campaign_id = c.id
order by c.name, ss.shift_name;
