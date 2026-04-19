-- ==========================================================================
-- Auto-derive daily digest fire time from shift_settings instead of manual
-- eod_digest_cutoff_time. The pg_cron job still runs every 5 min; only the
-- edge function internals change.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.campaigns_digest_fire_times()
RETURNS TABLE(
  campaign_id uuid,
  campaign_name text,
  eod_digest_timezone text,
  eod_morning_bundle_time time,
  digest_fire_time time
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id AS campaign_id,
    c.name AS campaign_name,
    COALESCE(c.eod_digest_timezone, 'America/Denver') AS eod_digest_timezone,
    c.eod_morning_bundle_time,
    (MAX(ss.end_time + make_interval(mins => COALESCE(ss.grace_minutes, 10)))
     + interval '5 minutes')::time AS digest_fire_time
  FROM campaigns c
  JOIN shift_settings ss ON ss.campaign_id = c.id
  WHERE EXTRACT(DOW FROM (now() AT TIME ZONE COALESCE(c.eod_digest_timezone, 'America/Denver')))::int
        = ANY(ss.days_of_week)
  GROUP BY c.id, c.name, c.eod_digest_timezone, c.eod_morning_bundle_time;
$$;
