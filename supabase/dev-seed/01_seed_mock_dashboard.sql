-- =============================================================================
-- DEV SEED: Mock dashboard data for EOD digest / TL-note card testing
-- =============================================================================
-- Run manually:  psql $DATABASE_URL -f 01_seed_mock_dashboard.sql
-- Reverse with:  psql $DATABASE_URL -f 02_teardown_mock_dashboard.sql
--
-- PRE-SEED STATE (record for teardown):
--   sandoval801 employee UUID : c0306166-2ab4-4047-8b64-93dd4889228d
--   sandoval801 campaign_id   : 0e30abfc-0f32-4c7f-85ba-3e81792963b7  (SLOC Weekday)
--   sandoval801 title         : team_lead
--   The mock campaign's team_lead_id is set to sandoval801's UUID.
--   sandoval801's own employee row is NOT changed — only the new campaign
--   references them as TL via campaigns.team_lead_id.
-- =============================================================================

BEGIN;

-- ======================== 1. Campaign ========================

INSERT INTO campaigns (id, client_id, name, team_lead_id, eod_digest_cutoff_time, eod_digest_timezone)
VALUES (
  'aaaaaaaa-0000-4000-a000-000000000001',
  'b494e61c-2eb0-4497-ba51-21f94c5943f1',  -- Torro
  'DEV_MOCK_TORRO_SLOC',
  'c0306166-2ab4-4047-8b64-93dd4889228d',  -- sandoval801
  '17:00:00',
  'America/Denver'
);

-- ======================== 2. KPI Config ========================

INSERT INTO campaign_kpi_config (campaign_id, field_name, field_label, field_type, min_target, is_required, is_active, display_order) VALUES
  ('aaaaaaaa-0000-4000-a000-000000000001', 'total_credit_pulls', 'Total Credit Pulls', 'number', 10, true, true, 0),
  ('aaaaaaaa-0000-4000-a000-000000000001', 'approvals',          'Approvals',          'number', NULL, true, true, 1),
  ('aaaaaaaa-0000-4000-a000-000000000001', 'scheduled',          'Scheduled',          'number', NULL, true, true, 2),
  ('aaaaaaaa-0000-4000-a000-000000000001', 'funded',             'Funded',             'number', NULL, true, true, 3),
  ('aaaaaaaa-0000-4000-a000-000000000001', 'dialer_issues',      'Any dialer issues today?', 'boolean', NULL, true, true, 4),
  ('aaaaaaaa-0000-4000-a000-000000000001', 'notes_narrative',    'Notes',              'text',   NULL, false, true, 5);

-- ======================== 3. Mock Agents (6) ========================

INSERT INTO employees (id, employee_id, full_name, email, title, is_active, campaign_id, reports_to, monthly_base_salary) VALUES
  ('aaaaaaaa-0000-4000-a000-000000000011', 'MOCK-01', 'Javier Caballero',  'mock.agent.01@joi-dev.local', 'agent', true, 'aaaaaaaa-0000-4000-a000-000000000001', 'c0306166-2ab4-4047-8b64-93dd4889228d', 12000),
  ('aaaaaaaa-0000-4000-a000-000000000012', 'MOCK-02', 'Maria Flores',      'mock.agent.02@joi-dev.local', 'agent', true, 'aaaaaaaa-0000-4000-a000-000000000001', 'c0306166-2ab4-4047-8b64-93dd4889228d', 12000),
  ('aaaaaaaa-0000-4000-a000-000000000013', 'MOCK-03', 'Carlos Mendez',     'mock.agent.03@joi-dev.local', 'agent', true, 'aaaaaaaa-0000-4000-a000-000000000001', 'c0306166-2ab4-4047-8b64-93dd4889228d', 12000),
  ('aaaaaaaa-0000-4000-a000-000000000014', 'MOCK-04', 'Lupe Ramirez',      'mock.agent.04@joi-dev.local', 'agent', true, 'aaaaaaaa-0000-4000-a000-000000000001', 'c0306166-2ab4-4047-8b64-93dd4889228d', 12000),
  ('aaaaaaaa-0000-4000-a000-000000000015', 'MOCK-05', 'Dante Ortiz',       'mock.agent.05@joi-dev.local', 'agent', true, 'aaaaaaaa-0000-4000-a000-000000000001', 'c0306166-2ab4-4047-8b64-93dd4889228d', 12000),
  ('aaaaaaaa-0000-4000-a000-000000000016', 'MOCK-06', 'Sam Taylor',        'mock.agent.06@joi-dev.local', 'agent', true, 'aaaaaaaa-0000-4000-a000-000000000001', 'c0306166-2ab4-4047-8b64-93dd4889228d', 12000);

-- ======================== 4. Shift Settings ========================

INSERT INTO shift_settings (campaign_id, shift_name, start_time, end_time, grace_minutes, days_of_week)
VALUES (
  'aaaaaaaa-0000-4000-a000-000000000001',
  'DEV_MOCK_TORRO_SLOC',
  '09:00:00', '17:00:00', 10,
  ARRAY[1,2,3,4,5]
);

-- ======================== 5. Recipients ========================

INSERT INTO campaign_eod_recipients (campaign_id, email, role_label, active) VALUES
  ('aaaaaaaa-0000-4000-a000-000000000001', 'mock.tl@joi-dev.local',     'tl',     true),
  ('aaaaaaaa-0000-4000-a000-000000000001', 'mock.client@joi-dev.local', 'client', true);

-- ======================== 6. Generate business days ========================
-- 15 most recent business days (Mon-Fri), ending today or last Fri.

CREATE TEMP TABLE _mock_bdays (d date, day_num int);

INSERT INTO _mock_bdays (d, day_num)
SELECT d, row_number() OVER (ORDER BY d DESC)
FROM generate_series(
  current_date - interval '25 days',
  current_date,
  interval '1 day'
) AS s(d)
WHERE extract(dow FROM d) BETWEEN 1 AND 5
ORDER BY d DESC
LIMIT 15;

-- ======================== 7. Time Clock ========================
-- Agent patterns:
--   01 Javier: always on time, full day
--   02 Maria:  always on time, full day
--   03 Carlos: on time, 1-2 absent days (day_num 7, 12)
--   04 Lupe:   mostly on time, 2 late days (day_num 4, 9)
--   05 Dante:  underperformer: 3 absent (day_num 3,8,13), 1 auto-clock-out (day_num 5)
--   06 Sam:    sliding: on time weeks 1-2, 2 late last week (day_num 1,2)

INSERT INTO time_clock (employee_id, date, clock_in, clock_out, is_late, late_minutes, total_hours, auto_clocked_out, eod_completed)
SELECT
  emp_id,
  b.d,
  -- clock_in: base 09:00 Denver = 15:00 UTC, vary ±10 min
  (to_char(b.d, 'YYYY-MM-DD') || 'T15:00:00Z')::timestamptz
    + (CASE
         -- Lupe late on days 4,9
         WHEN emp_num = 4 AND b.day_num IN (4,9) THEN interval '15 minutes'
         -- Sam late on days 1,2
         WHEN emp_num = 6 AND b.day_num IN (1,2) THEN interval '12 minutes'
         -- normal variance: hash-based offset -10..+5 min
         ELSE (( (hashtext(emp_id::text || b.d::text) % 16) - 10 ) * interval '1 minute')
       END),
  -- clock_out: 17:00 Denver = 23:00 UTC + 0..30 min
  CASE
    -- Dante auto-clock-out day 5: no real clock out, set to 23:59
    WHEN emp_num = 5 AND b.day_num = 5
      THEN (to_char(b.d, 'YYYY-MM-DD') || 'T23:59:00Z')::timestamptz
    ELSE
      (to_char(b.d, 'YYYY-MM-DD') || 'T23:00:00Z')::timestamptz
        + ((abs(hashtext(emp_id::text || b.d::text || 'out')) % 31) * interval '1 minute')
  END,
  -- is_late
  CASE
    WHEN emp_num = 4 AND b.day_num IN (4,9) THEN true
    WHEN emp_num = 6 AND b.day_num IN (1,2) THEN true
    ELSE false
  END,
  -- late_minutes
  CASE
    WHEN emp_num = 4 AND b.day_num IN (4,9) THEN 15
    WHEN emp_num = 6 AND b.day_num IN (1,2) THEN 12
    ELSE 0
  END,
  -- total_hours
  CASE
    WHEN emp_num = 5 AND b.day_num = 5 THEN 8.0
    ELSE 8.0 + (abs(hashtext(emp_id::text || b.d::text || 'hrs')) % 6) * 0.1
  END,
  -- auto_clocked_out
  CASE
    WHEN emp_num = 5 AND b.day_num = 5 THEN true
    WHEN emp_num = 6 AND b.day_num = 3 THEN true
    ELSE false
  END,
  -- eod_completed (false for absent/auto-clock-out days without EOD)
  CASE
    WHEN emp_num = 3 AND b.day_num IN (7,12) THEN false  -- Carlos absent
    WHEN emp_num = 5 AND b.day_num IN (3,5,8,13) THEN false -- Dante misses
    WHEN emp_num = 6 AND b.day_num = 3 THEN false  -- Sam auto-clock-out
    ELSE true
  END
FROM _mock_bdays b
CROSS JOIN (VALUES
  ('aaaaaaaa-0000-4000-a000-000000000011'::uuid, 1),
  ('aaaaaaaa-0000-4000-a000-000000000012'::uuid, 2),
  ('aaaaaaaa-0000-4000-a000-000000000013'::uuid, 3),
  ('aaaaaaaa-0000-4000-a000-000000000014'::uuid, 4),
  ('aaaaaaaa-0000-4000-a000-000000000015'::uuid, 5),
  ('aaaaaaaa-0000-4000-a000-000000000016'::uuid, 6)
) AS agents(emp_id, emp_num)
-- Skip absent days: Carlos day 7,12; Dante day 3,8,13
WHERE NOT (
  (emp_num = 3 AND b.day_num IN (7,12))
  OR (emp_num = 5 AND b.day_num IN (3,8,13))
);

-- ======================== 8. EOD Logs ========================
-- Skip days where agent was absent or auto-clocked-out without EOD.

INSERT INTO eod_logs (employee_id, date, campaign_id, metrics, notes)
SELECT
  emp_id,
  b.d,
  'aaaaaaaa-0000-4000-a000-000000000001',
  jsonb_build_object(
    'total_credit_pulls',
      CASE
        WHEN emp_num = 1 THEN 10 + (abs(hashtext(emp_id::text || b.d::text || 'pulls')) % 5)        -- 10-14
        WHEN emp_num = 2 THEN 11 + (abs(hashtext(emp_id::text || b.d::text || 'pulls')) % 5)        -- 11-15
        WHEN emp_num = 3 THEN 7  + (abs(hashtext(emp_id::text || b.d::text || 'pulls')) % 5)        -- 7-11
        WHEN emp_num = 4 THEN 8  + (abs(hashtext(emp_id::text || b.d::text || 'pulls')) % 5)        -- 8-12
        WHEN emp_num = 5 THEN 4  + (abs(hashtext(emp_id::text || b.d::text || 'pulls')) % 5)        -- 4-8
        WHEN emp_num = 6 AND b.day_num > 5
          THEN 9  + (abs(hashtext(emp_id::text || b.d::text || 'pulls')) % 5)                       -- 9-13 (weeks 1-2)
        WHEN emp_num = 6
          THEN 3  + (abs(hashtext(emp_id::text || b.d::text || 'pulls')) % 5)                       -- 3-7  (last week)
        ELSE 8
      END,
    'approvals',
      CASE
        WHEN emp_num IN (1,2) THEN 2 + (abs(hashtext(emp_id::text || b.d::text || 'app')) % 3)      -- 2-4
        WHEN emp_num IN (3,4) THEN 1 + (abs(hashtext(emp_id::text || b.d::text || 'app')) % 3)      -- 1-3
        WHEN emp_num = 5      THEN (abs(hashtext(emp_id::text || b.d::text || 'app')) % 2)           -- 0-1
        WHEN emp_num = 6 AND b.day_num > 5
          THEN 2 + (abs(hashtext(emp_id::text || b.d::text || 'app')) % 2)                           -- 2-3
        WHEN emp_num = 6
          THEN (abs(hashtext(emp_id::text || b.d::text || 'app')) % 2)                               -- 0-1
        ELSE 1
      END,
    'scheduled',
      1 + (abs(hashtext(emp_id::text || b.d::text || 'sched')) % 3),                                 -- 1-3
    'funded',
      (abs(hashtext(emp_id::text || b.d::text || 'fund')) % 2),                                      -- 0-1
    'dialer_issues',
      (abs(hashtext(emp_id::text || b.d::text || 'dial')) % 8) = 0,                                  -- ~12% true
    'notes_narrative',
      CASE
        WHEN (abs(hashtext(emp_id::text || b.d::text || 'narr')) % 7) = 0
          THEN (ARRAY[
            'Solid day, pipeline is moving.',
            'Had trouble reaching some leads early AM.',
            'Good calls today, 2 close to funding.',
            'Slow start but picked up after lunch.',
            'Dialer dropped 3 calls, rest was fine.',
            'Wrapped up a deal from yesterday.'
          ])[1 + abs(hashtext(emp_id::text || b.d::text || 'pick')) % 6]
        ELSE ''
      END
  ),
  -- notes column (top-level) — mostly null
  CASE
    WHEN (abs(hashtext(emp_id::text || b.d::text || 'topnote')) % 10) = 0
      THEN 'See metrics for details.'
    ELSE NULL
  END
FROM _mock_bdays b
CROSS JOIN (VALUES
  ('aaaaaaaa-0000-4000-a000-000000000011'::uuid, 1),
  ('aaaaaaaa-0000-4000-a000-000000000012'::uuid, 2),
  ('aaaaaaaa-0000-4000-a000-000000000013'::uuid, 3),
  ('aaaaaaaa-0000-4000-a000-000000000014'::uuid, 4),
  ('aaaaaaaa-0000-4000-a000-000000000015'::uuid, 5),
  ('aaaaaaaa-0000-4000-a000-000000000016'::uuid, 6)
) AS agents(emp_id, emp_num)
-- Skip: Carlos absent day 7,12; Dante absent/auto-clock-out day 3,5,8,13; Sam auto-clock-out day 3
WHERE NOT (
  (emp_num = 3 AND b.day_num IN (7,12))
  OR (emp_num = 5 AND b.day_num IN (3,5,8,13))
  OR (emp_num = 6 AND b.day_num = 3)
);

-- ======================== 9. TL Notes (last 5 business days) ========================

INSERT INTO campaign_eod_tl_notes (campaign_id, date, note, written_by)
SELECT
  'aaaaaaaa-0000-4000-a000-000000000001',
  d,
  (ARRAY[
    'Lupe out for doctor appt; Javier covering her leads.',
    'Team hit target today. Dante needs 1-on-1 re: missed EODs.',
    'Client asked for extra pull volume this week — team aware.',
    'Sam slipping on pulls. Scheduled check-in tomorrow AM.',
    'Solid day across the board. Maria crushed it.'
  ])[day_num],
  'c0306166-2ab4-4047-8b64-93dd4889228d'  -- sandoval801
FROM _mock_bdays
WHERE day_num <= 5
ORDER BY d;

-- ======================== Cleanup temp ========================

DROP TABLE _mock_bdays;

COMMIT;

-- ======================== Summary ========================
-- After running, verify with:
--   SELECT 'campaigns' as t, count(*) FROM campaigns WHERE name = 'DEV_MOCK_TORRO_SLOC'
--   UNION ALL SELECT 'employees', count(*) FROM employees WHERE email LIKE 'mock.agent.%@joi-dev.local'
--   UNION ALL SELECT 'time_clock', count(*) FROM time_clock WHERE employee_id IN (SELECT id FROM employees WHERE email LIKE 'mock.%@joi-dev.local')
--   UNION ALL SELECT 'eod_logs', count(*) FROM eod_logs WHERE campaign_id = 'aaaaaaaa-0000-4000-a000-000000000001'
--   UNION ALL SELECT 'tl_notes', count(*) FROM campaign_eod_tl_notes WHERE campaign_id = 'aaaaaaaa-0000-4000-a000-000000000001'
--   UNION ALL SELECT 'recipients', count(*) FROM campaign_eod_recipients WHERE campaign_id = 'aaaaaaaa-0000-4000-a000-000000000001'
--   UNION ALL SELECT 'kpi_config', count(*) FROM campaign_kpi_config WHERE campaign_id = 'aaaaaaaa-0000-4000-a000-000000000001';
