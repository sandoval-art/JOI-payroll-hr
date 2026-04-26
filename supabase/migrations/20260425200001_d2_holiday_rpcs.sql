-- Feature D Phase 2 — Holiday request RPCs
-- Two SECURITY DEFINER functions needed because agents can only see their own
-- holiday_requests rows via RLS and cannot count other agents' approved requests
-- client-side. Capacity logic must live in the DB.
--
-- RPCs:
--   get_campaign_holiday_capacities(p_campaign_id) — capacity map for all upcoming holidays
--   request_holiday_off(p_campaign_id, p_holiday_date, p_holiday_name) — atomic insert + auto-approve

-- ── RPC 1: get_campaign_holiday_capacities ────────────────────────────────────
-- Returns capacity info for all upcoming company_holidays for a given campaign.
-- Called once on page load by useCampaignHolidayCapacities hook.

CREATE OR REPLACE FUNCTION public.get_campaign_holiday_capacities(p_campaign_id uuid)
RETURNS TABLE(
  holiday_date  date,
  approved_count int,
  cap           int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    ch.date                                                     AS holiday_date,
    COUNT(hr.id) FILTER (WHERE hr.status = 'approved')::int    AS approved_count,
    GREATEST(1, FLOOR(
      (SELECT COUNT(*) FROM public.employees
       WHERE campaign_id = p_campaign_id AND is_active = true)
      * 0.20
    ))::int                                                     AS cap
  FROM public.company_holidays ch
  LEFT JOIN public.holiday_requests hr
    ON hr.holiday_date = ch.date AND hr.campaign_id = p_campaign_id
  WHERE ch.date > CURRENT_DATE
  GROUP BY ch.date
  ORDER BY ch.date;
$$;

GRANT EXECUTE ON FUNCTION public.get_campaign_holiday_capacities(uuid) TO authenticated;

-- ── RPC 2: request_holiday_off ────────────────────────────────────────────────
-- Atomically inserts a holiday request and auto-approves if under cap.
-- Idempotency guard: raises exception if a non-cancelled/denied request already
-- exists for this agent + holiday + campaign.
-- Returns the resulting status so the client can show the correct toast.

CREATE OR REPLACE FUNCTION public.request_holiday_off(
  p_campaign_id  uuid,
  p_holiday_date date,
  p_holiday_name text
)
RETURNS public.holiday_request_status
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_employee_id    uuid;
  v_headcount      int;
  v_cap            int;
  v_approved_count int;
  v_status         public.holiday_request_status;
BEGIN
  v_employee_id := public.my_employee_id();
  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'No employee record found for current user';
  END IF;

  -- Idempotency guard: block duplicate active requests
  IF EXISTS (
    SELECT 1 FROM public.holiday_requests
    WHERE employee_id = v_employee_id
      AND campaign_id = p_campaign_id
      AND holiday_date = p_holiday_date
      AND status NOT IN ('cancelled', 'denied')
  ) THEN
    RAISE EXCEPTION 'You already have an active request for this holiday';
  END IF;

  -- Compute 20% cap (minimum 1 slot)
  SELECT COUNT(*) INTO v_headcount
  FROM public.employees
  WHERE campaign_id = p_campaign_id AND is_active = true;

  v_cap := GREATEST(1, FLOOR(v_headcount * 0.20));

  -- Count currently approved requests for this holiday + campaign
  SELECT COUNT(*) INTO v_approved_count
  FROM public.holiday_requests
  WHERE campaign_id = p_campaign_id
    AND holiday_date = p_holiday_date
    AND status = 'approved';

  -- Auto-approve if under cap, otherwise send to TL
  v_status := CASE WHEN v_approved_count < v_cap THEN 'approved' ELSE 'pending_tl' END;

  INSERT INTO public.holiday_requests(
    employee_id, campaign_id, holiday_date, holiday_name, status
  ) VALUES (
    v_employee_id, p_campaign_id, p_holiday_date, p_holiday_name, v_status
  );

  RETURN v_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_holiday_off(uuid, date, text) TO authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
