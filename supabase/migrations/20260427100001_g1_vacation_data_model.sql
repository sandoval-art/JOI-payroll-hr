-- Feature G Phase 1 — Vacation / PTO data model
-- Schema-only phase: vacation_requests table, get_vacation_balance RPC. No UI, no hooks.
--
-- Sections:
--   A. vacation_requests table + RLS
--   B. get_vacation_balance() SECURITY DEFINER function (LFT 2023 entitlement formula)
--   C. Schema reload
--
-- RLS pattern:
--   Agents  → public.my_employee_id()            (SECURITY DEFINER, from 20260416000001)
--   TL      → public.is_team_lead()
--              + public.tl_employee_on_my_team()  (SECURITY DEFINER, from 20260423200001)
--   HR/Lead → public.is_leadership()              (SECURITY DEFINER, from 20260416000001)

-- ── A. vacation_requests ──────────────────────────────────────────────────────

CREATE TABLE public.vacation_requests (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     uuid        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  campaign_id     uuid        NOT NULL REFERENCES public.campaigns(id),
  start_date      date        NOT NULL,
  end_date        date        NOT NULL,
  days_requested  integer     NOT NULL,
  status          text        NOT NULL DEFAULT 'pending_tl'
                              CHECK (status IN ('pending_tl','pending_hr','approved','denied','cancelled')),
  notes           text,
  tl_reviewed_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  tl_reviewed_at  timestamptz,
  hr_reviewed_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  hr_reviewed_at  timestamptz,
  denial_reason   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vacation_valid_dates CHECK (end_date >= start_date)
);

ALTER TABLE public.vacation_requests ENABLE ROW LEVEL SECURITY;

-- Agent: read/write own requests
CREATE POLICY "vacation_requests_agent_select" ON public.vacation_requests
  FOR SELECT USING (employee_id = public.my_employee_id());

CREATE POLICY "vacation_requests_agent_insert" ON public.vacation_requests
  FOR INSERT WITH CHECK (employee_id = public.my_employee_id());

CREATE POLICY "vacation_requests_agent_update" ON public.vacation_requests
  FOR UPDATE USING (employee_id = public.my_employee_id());

-- TL: read + update team members' requests
CREATE POLICY "vacation_requests_tl_select" ON public.vacation_requests
  FOR SELECT USING (public.is_team_lead() AND public.tl_employee_on_my_team(employee_id));

CREATE POLICY "vacation_requests_tl_update" ON public.vacation_requests
  FOR UPDATE USING (public.is_team_lead() AND public.tl_employee_on_my_team(employee_id));

-- Leadership: full access
CREATE POLICY "vacation_requests_leadership_all" ON public.vacation_requests
  FOR ALL
  USING (public.is_leadership())
  WITH CHECK (public.is_leadership());

-- ── B. get_vacation_balance RPC ───────────────────────────────────────────────
-- Computes LFT 2023 entitlement for an employee in a given calendar year.
-- Entitlement schedule (LFT Art. 76 as amended 2023):
--   < 1 year   : 0 days
--   1 year     : 12 days
--   2 years    : 14 days
--   3 years    : 16 days
--   4 years    : 18 days (= 10 + year*2 for years 1–4)
--   5–9 years  : 20 days
--   10–14 years: 22 days
--   15–19 years: 24 days  (= 20 + floor((years-5)/5)*2)
--   etc.

CREATE OR REPLACE FUNCTION public.get_vacation_balance(
  p_employee_id uuid,
  p_year        integer DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::integer
)
RETURNS TABLE (
  entitlement_days      integer,
  used_days             integer,
  available_days        integer,
  years_of_service      integer,
  next_entitlement_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hire_date   date;
  v_completed   integer;
  v_entitlement integer;
  v_used        integer;
  v_next_date   date;
BEGIN
  SELECT hire_date INTO v_hire_date FROM public.employees WHERE id = p_employee_id;
  IF v_hire_date IS NULL THEN
    RETURN QUERY SELECT 0, 0, 0, 0, NULL::date;
    RETURN;
  END IF;

  -- Completed full years of service as of Jan 1 of the given year
  v_completed := DATE_PART('year', AGE(make_date(p_year, 1, 1), v_hire_date))::integer;

  -- LFT 2023 entitlement formula
  IF v_completed < 1 THEN
    v_entitlement := 0;
    v_next_date   := (v_hire_date + INTERVAL '1 year')::date;
  ELSIF v_completed <= 4 THEN
    v_entitlement := 10 + v_completed * 2;  -- 12, 14, 16, 18
    v_next_date   := NULL;
  ELSE
    v_entitlement := 20 + (FLOOR((v_completed - 5) / 5.0) * 2)::integer;
    v_next_date   := NULL;
  END IF;

  -- Used: sum of approved requests with start_date in p_year
  SELECT COALESCE(SUM(days_requested), 0) INTO v_used
  FROM public.vacation_requests
  WHERE employee_id = p_employee_id
    AND status = 'approved'
    AND EXTRACT(YEAR FROM start_date) = p_year;

  RETURN QUERY SELECT
    v_entitlement,
    v_used,
    GREATEST(0, v_entitlement - v_used),
    v_completed,
    v_next_date;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_vacation_balance(uuid, integer) TO authenticated;

-- ── C. Schema reload ──────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';
