-- ============================================================================
-- Migration: 20260416000003_eod_digest_foundation
-- Purpose:   Tables and columns for campaign EOD digest emails.
--            - campaign_eod_recipients: who receives the digest per campaign
--            - campaign_eod_tl_notes: TL daily summary note per campaign
--            - campaigns.eod_digest_cutoff_time / eod_digest_timezone
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. campaign_eod_recipients
-- ============================================================================

CREATE TABLE public.campaign_eod_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  email text NOT NULL,
  role_label text NOT NULL CHECK (role_label IN ('tl', 'manager', 'client', 'other')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, email)
);

CREATE INDEX idx_eod_recipients_campaign ON public.campaign_eod_recipients(campaign_id);

-- ============================================================================
-- 2. campaign_eod_tl_notes
-- ============================================================================

CREATE TABLE public.campaign_eod_tl_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  date date NOT NULL,
  note text,
  written_by uuid REFERENCES public.employees(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, date)
);

CREATE INDEX idx_eod_tl_notes_campaign_date ON public.campaign_eod_tl_notes(campaign_id, date);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_eod_tl_notes_updated_at
  BEFORE UPDATE ON public.campaign_eod_tl_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 3. New columns on campaigns
-- ============================================================================

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS eod_digest_cutoff_time time,
  ADD COLUMN IF NOT EXISTS eod_digest_timezone text NOT NULL DEFAULT 'America/Denver';

-- ============================================================================
-- 4. RLS — matching 5-tier model from 20260416000001_rls_hardening
-- ============================================================================

-- campaign_eod_recipients
ALTER TABLE public.campaign_eod_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leadership_all_eod_recipients"
  ON public.campaign_eod_recipients FOR ALL TO authenticated
  USING (public.is_leadership())
  WITH CHECK (public.is_leadership());

CREATE POLICY "tl_select_own_campaign_eod_recipients"
  ON public.campaign_eod_recipients FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND campaign_id IN (SELECT public.my_tl_campaign_ids())
  );

CREATE POLICY "tl_insert_own_campaign_eod_recipients"
  ON public.campaign_eod_recipients FOR INSERT TO authenticated
  WITH CHECK (
    public.is_team_lead()
    AND campaign_id IN (SELECT public.my_tl_campaign_ids())
  );

CREATE POLICY "tl_update_own_campaign_eod_recipients"
  ON public.campaign_eod_recipients FOR UPDATE TO authenticated
  USING (
    public.is_team_lead()
    AND campaign_id IN (SELECT public.my_tl_campaign_ids())
  );

CREATE POLICY "tl_delete_own_campaign_eod_recipients"
  ON public.campaign_eod_recipients FOR DELETE TO authenticated
  USING (
    public.is_team_lead()
    AND campaign_id IN (SELECT public.my_tl_campaign_ids())
  );

-- campaign_eod_tl_notes
ALTER TABLE public.campaign_eod_tl_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leadership_all_eod_tl_notes"
  ON public.campaign_eod_tl_notes FOR ALL TO authenticated
  USING (public.is_leadership())
  WITH CHECK (public.is_leadership());

CREATE POLICY "tl_select_own_campaign_eod_tl_notes"
  ON public.campaign_eod_tl_notes FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND campaign_id IN (SELECT public.my_tl_campaign_ids())
  );

CREATE POLICY "tl_insert_own_campaign_eod_tl_notes"
  ON public.campaign_eod_tl_notes FOR INSERT TO authenticated
  WITH CHECK (
    public.is_team_lead()
    AND campaign_id IN (SELECT public.my_tl_campaign_ids())
  );

CREATE POLICY "tl_update_own_campaign_eod_tl_notes"
  ON public.campaign_eod_tl_notes FOR UPDATE TO authenticated
  USING (
    public.is_team_lead()
    AND campaign_id IN (SELECT public.my_tl_campaign_ids())
  );

COMMIT;
