-- ============================================================================
-- Migration: 20260417000001_eod_digest_sending_infra
-- Purpose:   Infrastructure for the daily digest edge function.
--            - campaigns.eod_reply_to_email column
--            - eod_digest_log table (audit + double-send guard)
--            - RLS: leadership full, TL read-only on own campaigns, agents none
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. New column on campaigns
-- ============================================================================

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS eod_reply_to_email text;

COMMENT ON COLUMN public.campaigns.eod_reply_to_email
  IS 'Reply-To address for digest emails. NULL = use sender address.';

-- ============================================================================
-- 2. eod_digest_log
-- ============================================================================

CREATE TABLE public.eod_digest_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  digest_date date NOT NULL,
  digest_type text NOT NULL CHECK (digest_type IN ('daily', 'late_bundle')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  recipient_count int NOT NULL DEFAULT 0,
  agent_submission_count int NOT NULL DEFAULT 0,
  agent_missing_count int NOT NULL DEFAULT 0,
  missing_agents jsonb,
  dry_run boolean NOT NULL DEFAULT true,
  smtp_message_id text,
  error text,
  UNIQUE (campaign_id, digest_date, digest_type)
);

CREATE INDEX idx_eod_digest_log_campaign_date
  ON public.eod_digest_log (campaign_id, digest_date DESC);

-- ============================================================================
-- 3. RLS — matching 5-tier model
-- ============================================================================

ALTER TABLE public.eod_digest_log ENABLE ROW LEVEL SECURITY;

-- Leadership: full access
CREATE POLICY "leadership_all_eod_digest_log"
  ON public.eod_digest_log FOR ALL TO authenticated
  USING (public.is_leadership())
  WITH CHECK (public.is_leadership());

-- Team leads: read-only on their own campaigns
CREATE POLICY "tl_select_own_campaign_eod_digest_log"
  ON public.eod_digest_log FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND campaign_id IN (SELECT public.my_tl_campaign_ids())
  );

-- Agents: no policies = no access

COMMIT;
