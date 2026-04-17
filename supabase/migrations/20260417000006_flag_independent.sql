-- ============================================================================
-- Migration: 20260417000006_flag_independent
-- Purpose:   Adds "flag_independent" to campaign_kpi_config.
--
--   flag_independent = true  (default) → this field alone can trigger the TL
--                                         flag on the dashboard.
--   flag_independent = false           → this field is tracked and displayed
--                                         but will NOT fire the flag on its own.
--                                         Useful for "effort" metrics like
--                                         calls_made where high output on a
--                                         primary KPI should override a low
--                                         dial count.
-- ============================================================================

ALTER TABLE public.campaign_kpi_config
  ADD COLUMN IF NOT EXISTS flag_independent boolean NOT NULL DEFAULT true;

-- calls_made is an effort indicator, not a primary performance KPI.
-- A high credit-pull count already proves the agent is working.
UPDATE public.campaign_kpi_config
  SET flag_independent = false
  WHERE field_name = 'calls_made';
