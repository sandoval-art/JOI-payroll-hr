-- Feature D7 — Holiday no-show auto-detection
-- Part A: Schema tweaks to attendance_incidents for system-generated rows
-- Part B: detect_holiday_no_shows() SECURITY DEFINER function
-- Part C: Daily pg_cron job

-- ── Part A: Allow system-generated incidents ──────────────────────────────────

-- created_by can now be NULL when source = 'auto_detection'
ALTER TABLE public.attendance_incidents
  ALTER COLUMN created_by DROP NOT NULL;

-- Source column: manual (TL/HR filed) vs auto_detection (cron-generated)
ALTER TABLE public.attendance_incidents
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'auto_detection'));

-- ── Part B: Detection function ────────────────────────────────────────────────
-- Logic:
--   1. Guard: bail if p_date is not a statutory holiday.
--   2. Find all active agents in campaigns where requires_holiday_coverage = true.
--   3. Exclude agents with an approved holiday_request for that date.
--   4. Exclude agents who have any time_clock entry on that date.
--   5. Insert no_call_no_show incident for the remainder, idempotent via ON CONFLICT DO NOTHING.
--   6. Returns count of new rows inserted.

CREATE OR REPLACE FUNCTION public.detect_holiday_no_shows(p_date date)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_holiday boolean;
  v_inserted   int := 0;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM company_holidays
    WHERE date = p_date AND is_statutory = true
  ) INTO v_is_holiday;

  IF NOT v_is_holiday THEN
    RETURN 0;
  END IF;

  WITH noshow_agents AS (
    SELECT e.id AS employee_id
    FROM employees e
    JOIN campaigns c ON c.id = e.campaign_id
    WHERE e.is_active = true
      AND c.requires_holiday_coverage = true
      AND NOT EXISTS (
        SELECT 1 FROM holiday_requests hr
        WHERE hr.employee_id = e.id
          AND hr.campaign_id = e.campaign_id
          AND hr.holiday_date = p_date
          AND hr.status = 'approved'
      )
      AND NOT EXISTS (
        SELECT 1 FROM time_clock tc
        WHERE tc.employee_id = e.id
          AND tc.clock_in::date = p_date
      )
  )
  INSERT INTO attendance_incidents
    (employee_id, date, incident_type, notes, source, created_by)
  SELECT
    employee_id,
    p_date,
    'no_call_no_show',
    'Auto-detected: agent did not clock in on a statutory holiday and had no approved time-off request.',
    'auto_detection',
    NULL
  FROM noshow_agents
  ON CONFLICT (employee_id, date) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

-- ── Part C: Daily pg_cron job at noon UTC (7am Central MX time) ──────────────
-- Runs the day AFTER each holiday. Checks if yesterday was a statutory holiday.
-- unschedule wrapped to avoid error if job doesn't yet exist.

DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('holiday-noshow-detection');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$$;

SELECT cron.schedule(
  'holiday-noshow-detection',
  '0 12 * * *',
  $$SELECT public.detect_holiday_no_shows(CURRENT_DATE - 1);$$
);

NOTIFY pgrst, 'reload schema';
