-- ============================================================================
-- Migration: 20260417000007_eod_digest_function_cron
-- Purpose:   1. Add preview_body column to eod_digest_log
--            2. Schedule pg_cron job to invoke send-daily-eod-digest every 15 min
-- ============================================================================

BEGIN;

-- 1. Add preview_body for dry-run inspection
ALTER TABLE public.eod_digest_log
  ADD COLUMN IF NOT EXISTS preview_body text;

COMMENT ON COLUMN public.eod_digest_log.preview_body
  IS 'Rendered digest body stored during dry-run for review before enabling real sends.';

-- 2. pg_cron: invoke the edge function every 15 minutes
-- The function checks each campaign's cutoff time in its own timezone,
-- so running every 15 min ensures we catch cutoffs within a ~15 min window.
SELECT cron.schedule(
  'send-daily-eod-digest',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://jpaihltkrohdqkqlbqkf.supabase.co/functions/v1/send-daily-eod-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

COMMIT;
