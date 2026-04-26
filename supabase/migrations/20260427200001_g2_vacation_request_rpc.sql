-- Feature G Phase 2 — request_vacation_off SECURITY DEFINER RPC
-- Validates 21-day advance notice, balance, and overlap, then inserts the request.

CREATE OR REPLACE FUNCTION public.request_vacation_off(
  p_employee_id   uuid,
  p_campaign_id   uuid,
  p_start_date    date,
  p_end_date      date,
  p_notes         text DEFAULT NULL
)
RETURNS public.vacation_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days        integer;
  v_balance     record;
  v_overlap     integer;
  v_result      public.vacation_requests;
BEGIN
  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'end_date must be >= start_date' USING ERRCODE = 'P0001';
  END IF;

  IF p_start_date < (CURRENT_DATE + INTERVAL '21 days')::date THEN
    RAISE EXCEPTION 'Vacation must be requested at least 21 days in advance' USING ERRCODE = 'P0001';
  END IF;

  v_days := (p_end_date - p_start_date + 1);

  SELECT * INTO v_balance FROM public.get_vacation_balance(p_employee_id);

  IF v_balance.available_days < v_days THEN
    RAISE EXCEPTION 'Insufficient vacation balance (% days requested, % available)',
      v_days, v_balance.available_days USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_overlap
  FROM public.vacation_requests
  WHERE employee_id = p_employee_id
    AND status NOT IN ('denied', 'cancelled')
    AND start_date <= p_end_date
    AND end_date   >= p_start_date;

  IF v_overlap > 0 THEN
    RAISE EXCEPTION 'You already have a vacation request overlapping those dates' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.vacation_requests
    (employee_id, campaign_id, start_date, end_date, days_requested, notes, status)
  VALUES
    (p_employee_id, p_campaign_id, p_start_date, p_end_date, v_days, p_notes, 'pending_tl')
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_vacation_off(uuid, uuid, date, date, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
