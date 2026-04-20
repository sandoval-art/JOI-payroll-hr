-- A3b: Schedule daily compliance notification sweep via pg_cron.
-- Runs once daily at 9:00 AM America/Denver (15:00 UTC in MDT, 16:00 UTC in MST).
-- Uses the same auth pattern as the EOD digest cron jobs.

SELECT cron.schedule(
  'compliance-notifications-daily',
  '0 15 * * *',
  $$
    SELECT net.http_post(
      url     := 'https://jpaihltkrohdqkqlbqkf.supabase.co/functions/v1/compliance-notifications',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'x-cron-secret', app_config_value('cron_secret')
      ),
      body    := '{"mode": "daily"}'::jsonb
    ) AS request_id;
  $$
);
