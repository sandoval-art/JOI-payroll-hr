-- =============================================================================
-- TEARDOWN: Remove all mock dashboard data created by 01_seed_mock_dashboard.sql
-- =============================================================================
-- Run manually:  psql $DATABASE_URL -f 02_teardown_mock_dashboard.sql
--
-- PRE-SEED STATE to restore:
--   sandoval801's own employee row was NOT modified by the seed.
--   Only the mock campaign referenced them as team_lead_id.
--   Deleting the campaign removes that reference automatically.
-- =============================================================================

BEGIN;

-- Snapshot counts before deletion
DO $$
DECLARE
  _campaign_id uuid := 'aaaaaaaa-0000-4000-a000-000000000001';
  _cnt bigint;
BEGIN
  SELECT count(*) INTO _cnt FROM eod_logs WHERE campaign_id = _campaign_id;
  RAISE NOTICE '[BEFORE] eod_logs: %', _cnt;

  SELECT count(*) INTO _cnt FROM time_clock WHERE employee_id IN (SELECT id FROM employees WHERE email LIKE 'mock.%@joi-dev.local');
  RAISE NOTICE '[BEFORE] time_clock: %', _cnt;

  SELECT count(*) INTO _cnt FROM campaign_eod_tl_notes WHERE campaign_id = _campaign_id;
  RAISE NOTICE '[BEFORE] campaign_eod_tl_notes: %', _cnt;

  SELECT count(*) INTO _cnt FROM campaign_eod_recipients WHERE campaign_id = _campaign_id;
  RAISE NOTICE '[BEFORE] campaign_eod_recipients: %', _cnt;

  SELECT count(*) INTO _cnt FROM campaign_kpi_config WHERE campaign_id = _campaign_id;
  RAISE NOTICE '[BEFORE] campaign_kpi_config: %', _cnt;

  SELECT count(*) INTO _cnt FROM shift_settings WHERE campaign_id = _campaign_id;
  RAISE NOTICE '[BEFORE] shift_settings: %', _cnt;

  SELECT count(*) INTO _cnt FROM employees WHERE email LIKE 'mock.%@joi-dev.local';
  RAISE NOTICE '[BEFORE] employees (mock): %', _cnt;

  SELECT count(*) INTO _cnt FROM campaigns WHERE name = 'DEV_MOCK_TORRO_SLOC';
  RAISE NOTICE '[BEFORE] campaigns (mock): %', _cnt;
END $$;

-- 1. eod_logs (FK to employees and campaigns)
DELETE FROM eod_logs
WHERE campaign_id = 'aaaaaaaa-0000-4000-a000-000000000001';

-- 2. time_clock (FK to employees)
DELETE FROM time_clock
WHERE employee_id IN (
  SELECT id FROM employees WHERE email LIKE 'mock.%@joi-dev.local'
);

-- 3. campaign_eod_tl_notes (FK to campaigns — CASCADE would handle this, but explicit is safer)
DELETE FROM campaign_eod_tl_notes
WHERE campaign_id = 'aaaaaaaa-0000-4000-a000-000000000001';

-- 4. campaign_eod_recipients (FK to campaigns)
DELETE FROM campaign_eod_recipients
WHERE campaign_id = 'aaaaaaaa-0000-4000-a000-000000000001';

-- 5. campaign_kpi_config (FK to campaigns)
DELETE FROM campaign_kpi_config
WHERE campaign_id = 'aaaaaaaa-0000-4000-a000-000000000001';

-- 6. shift_settings (FK to campaigns)
DELETE FROM shift_settings
WHERE campaign_id = 'aaaaaaaa-0000-4000-a000-000000000001';

-- 7. employees (mock agents)
DELETE FROM employees
WHERE email LIKE 'mock.%@joi-dev.local';

-- 8. campaign itself
DELETE FROM campaigns
WHERE name = 'DEV_MOCK_TORRO_SLOC';

-- Snapshot counts after deletion (should all be 0)
DO $$
DECLARE
  _campaign_id uuid := 'aaaaaaaa-0000-4000-a000-000000000001';
  _cnt bigint;
BEGIN
  SELECT count(*) INTO _cnt FROM eod_logs WHERE campaign_id = _campaign_id;
  RAISE NOTICE '[AFTER] eod_logs: %', _cnt;

  SELECT count(*) INTO _cnt FROM time_clock WHERE employee_id IN (SELECT id FROM employees WHERE email LIKE 'mock.%@joi-dev.local');
  RAISE NOTICE '[AFTER] time_clock: %', _cnt;

  SELECT count(*) INTO _cnt FROM campaign_eod_tl_notes WHERE campaign_id = _campaign_id;
  RAISE NOTICE '[AFTER] campaign_eod_tl_notes: %', _cnt;

  SELECT count(*) INTO _cnt FROM campaign_eod_recipients WHERE campaign_id = _campaign_id;
  RAISE NOTICE '[AFTER] campaign_eod_recipients: %', _cnt;

  SELECT count(*) INTO _cnt FROM campaign_kpi_config WHERE campaign_id = _campaign_id;
  RAISE NOTICE '[AFTER] campaign_kpi_config: %', _cnt;

  SELECT count(*) INTO _cnt FROM shift_settings WHERE campaign_id = _campaign_id;
  RAISE NOTICE '[AFTER] shift_settings: %', _cnt;

  SELECT count(*) INTO _cnt FROM employees WHERE email LIKE 'mock.%@joi-dev.local';
  RAISE NOTICE '[AFTER] employees (mock): %', _cnt;

  SELECT count(*) INTO _cnt FROM campaigns WHERE name = 'DEV_MOCK_TORRO_SLOC';
  RAISE NOTICE '[AFTER] campaigns (mock): %', _cnt;
END $$;

COMMIT;
