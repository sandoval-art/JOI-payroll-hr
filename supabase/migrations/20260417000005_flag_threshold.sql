-- ============================================================================
-- Migration: 20260417000005_flag_threshold
-- Purpose:   Separates "flag_threshold" from "min_target" on campaign_kpi_config.
--
--   min_target     = the daily goal shown to agents in their EOD form
--   flag_threshold = the floor below which the TL flag fires on the dashboard
--
-- Both are optional. If flag_threshold is null the flag is never shown for
-- that field. If min_target is null the field shows no target hint.
-- ============================================================================

ALTER TABLE public.campaign_kpi_config
  ADD COLUMN IF NOT EXISTS flag_threshold numeric(10,2);
