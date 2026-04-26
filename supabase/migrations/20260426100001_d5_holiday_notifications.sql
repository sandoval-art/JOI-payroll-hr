-- Feature D Phase 5 — Holiday client notifications
--
-- Part A: holiday_notification_sent dedupe table
-- Part B: get_client_holiday_summary RPC (client portal)
-- Part C: daily cron registration

-- ── Part A: Dedupe table ──────────────────────────────────────────────────────

CREATE TABLE public.holiday_notification_sent (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid        NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  holiday_date date        NOT NULL,
  days_before  int         NOT NULL CHECK (days_before IN (14, 7)),
  sent_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, holiday_date, days_before)
);

ALTER TABLE public.holiday_notification_sent ENABLE ROW LEVEL SECURITY;
-- Service role only — edge function uses service role key. No authenticated user policies needed.

-- ── Part B: get_client_holiday_summary RPC ────────────────────────────────────
-- Returns the next upcoming holiday summary for a given campaign.
-- Used by the client portal holiday card.
-- SECURITY DEFINER so the RLS on holiday_requests is bypassed
-- (client only needs aggregate counts, not individual rows).

CREATE OR REPLACE FUNCTION public.get_client_holiday_summary(p_campaign_id uuid)
RETURNS TABLE(
  holiday_date         date,
  holiday_name         text,
  requires_coverage    boolean,
  approved_off         int,
  total_headcount      int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    ch.date                                                             AS holiday_date,
    ch.name                                                             AS holiday_name,
    c.requires_holiday_coverage                                         AS requires_coverage,
    COUNT(hr.id) FILTER (WHERE hr.status = 'approved')::int            AS approved_off,
    COUNT(e.id) FILTER (WHERE e.is_active = true)::int                 AS total_headcount
  FROM public.company_holidays ch
  CROSS JOIN public.campaigns c
  LEFT JOIN public.holiday_requests hr
    ON hr.holiday_date = ch.date AND hr.campaign_id = p_campaign_id
  LEFT JOIN public.employees e
    ON e.campaign_id = p_campaign_id
  WHERE ch.date > CURRENT_DATE
    AND c.id = p_campaign_id
    -- Scope to requesting client's campaigns
    AND p_campaign_id IN (SELECT public.my_client_campaign_ids())
  ORDER BY ch.date
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_holiday_summary(uuid) TO authenticated;

-- ── Part C: Daily cron ────────────────────────────────────────────────────────
-- Fires at 2pm UTC daily (8am Central MX time).
-- Unschedule first to make idempotent on re-runs.

SELECT cron.unschedule('holiday-notifications-daily');

SELECT cron.schedule(
  'holiday-notifications-daily',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url     := app_config_value('app_url') || '/functions/v1/holiday-notifications',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', app_config_value('cron_secret')
    ),
    body    := '{"mode":"cron"}'::jsonb
  ) AS request_id;
  $$
);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
