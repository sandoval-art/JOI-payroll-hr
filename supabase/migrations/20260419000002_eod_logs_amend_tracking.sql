-- ==========================================================================
-- EOD amendment tracking: last_edited_at, edit_count, agent update policy
-- ==========================================================================

-- 1. New columns on eod_logs -----------------------------------------------
ALTER TABLE public.eod_logs
  ADD COLUMN IF NOT EXISTS last_edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS edit_count int NOT NULL DEFAULT 0;

-- 2. Helper: true when the campaign's cutoff hasn't passed for a given date -
--    Used by the agent UPDATE policy to limit self-edits to before-cutoff.
CREATE OR REPLACE FUNCTION public.eod_before_cutoff(p_campaign_id uuid, p_date date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- EOD date must be "today" in campaign tz
    p_date = (now() AT TIME ZONE COALESCE(c.eod_digest_timezone, 'America/Denver'))::date
    -- AND cutoff time hasn't passed yet
    AND (now() AT TIME ZONE COALESCE(c.eod_digest_timezone, 'America/Denver'))::time
        < c.eod_digest_cutoff_time
  FROM public.campaigns c
  WHERE c.id = p_campaign_id
    AND c.eod_digest_cutoff_time IS NOT NULL;
$$;

-- 3. Agent UPDATE policy: own rows, before cutoff only ----------------------
CREATE POLICY "agents_update_own_eod_logs_before_cutoff"
  ON public.eod_logs FOR UPDATE TO authenticated
  USING (
    employee_id = public.my_employee_id()
    AND public.eod_before_cutoff(campaign_id, date)
  )
  WITH CHECK (
    employee_id = public.my_employee_id()
  );

-- 4. RPC for atomic amendment (increments edit_count) -----------------------
--    SECURITY INVOKER so RLS applies to the caller's role.
CREATE OR REPLACE FUNCTION public.amend_eod_log(
  p_log_id uuid,
  p_metrics jsonb,
  p_notes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  UPDATE public.eod_logs
  SET metrics = p_metrics,
      notes = p_notes,
      last_edited_at = now(),
      edit_count = edit_count + 1
  WHERE id = p_log_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EOD log not found or not editable';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.amend_eod_log(uuid, jsonb, text)
  TO authenticated;
