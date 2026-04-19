-- ==========================================================================
-- app_config table + app_config_value() function + cron job rewrites
--
-- Captures the live state created via MCP on 2026-04-19.
-- Idempotent: safe to run against the live DB (verified as no-op).
-- ==========================================================================

-- 1. Config table ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_config (
  key   text PRIMARY KEY,
  value text NOT NULL
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Only service_role may read/write directly (the SECURITY DEFINER function
-- is the intended read path for other callers like pg_cron).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.app_config'::regclass
      AND polname  = 'service_role_full_access'
  ) THEN
    CREATE POLICY service_role_full_access ON public.app_config
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

-- 2. Lookup helper ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_config_value(p_key text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT value FROM public.app_config WHERE key = p_key;
$$;

GRANT EXECUTE ON FUNCTION public.app_config_value(text)
  TO postgres, authenticated, anon, service_role;

-- 3. Cron job rewrites -----------------------------------------------------
-- Unschedule old jobs (ignore if they don't exist).
SELECT cron.unschedule('eod-digest-check');
SELECT cron.unschedule('eod-morning-bundle-check');

-- Re-schedule with app_config_value() instead of current_setting().
SELECT cron.schedule(
  'eod-digest-check',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://jpaihltkrohdqkqlbqkf.supabase.co/functions/v1/send-eod-digest',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'x-cron-secret', app_config_value('cron_secret')
      ),
      body    := '{}'::jsonb
    ) AS request_id;
  $$
);

SELECT cron.schedule(
  'eod-morning-bundle-check',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://jpaihltkrohdqkqlbqkf.supabase.co/functions/v1/send-eod-digest',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'x-cron-secret', app_config_value('cron_secret')
      ),
      body    := '{"type": "morning_bundle"}'::jsonb
    ) AS request_id;
  $$
);

-- 4. Setup reminder --------------------------------------------------------
-- After running this migration on a fresh environment, insert your secret:
-- INSERT INTO public.app_config (key, value)
--   VALUES ('cron_secret', '<put-your-own-random-string-here>');
-- Then set the same value as CRON_SECRET in the edge function secrets.
