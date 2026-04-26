-- Feature D Phase 1 — Holiday calendar data model
-- Schema-only phase: campaigns column, company_holidays table, holiday_requests table, RLS.
-- No UI, no hooks. Those land in D2/D3/D4.
--
-- Sections:
--   A. campaigns.requires_holiday_coverage column
--   B. company_holidays table + RLS + 2026/2027 seed data
--   C. holiday_request_status enum + holiday_requests table + RLS
--
-- RLS pattern:
--   Agents  → public.my_employee_id()            (SECURITY DEFINER, from 20260416000001)
--   TL      → public.is_team_lead()
--              + public.tl_employee_on_my_team()  (SECURITY DEFINER, from 20260423200001)
--   HR/Lead → public.is_leadership()              (SECURITY DEFINER, from 20260416000001)

-- ── A. campaigns.requires_holiday_coverage ────────────────────────────────────

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS requires_holiday_coverage boolean NOT NULL DEFAULT false;

-- ── B. company_holidays ───────────────────────────────────────────────────────

CREATE TABLE public.company_holidays (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  date         date        NOT NULL UNIQUE,
  name         text        NOT NULL,
  is_statutory boolean     NOT NULL DEFAULT false,
  created_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_holidays ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (agents need this to display the holiday list)
CREATE POLICY "company_holidays_read" ON public.company_holidays
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only leadership can insert/update/delete
CREATE POLICY "company_holidays_leadership_write" ON public.company_holidays
  FOR ALL USING (public.is_leadership())
  WITH CHECK (public.is_leadership());

-- Seed 2026 statutory holidays (LFT-adjusted dates)
-- Constitución = first Monday of Feb → 2026-02-02
-- Juárez       = third Monday of Mar → 2026-03-16
-- Revolución   = third Monday of Nov → 2026-11-16
INSERT INTO public.company_holidays (date, name, is_statutory) VALUES
  ('2026-01-01', 'Año Nuevo',                 true),
  ('2026-02-02', 'Día de la Constitución',    true),
  ('2026-03-16', 'Natalicio de Benito Juárez',true),
  ('2026-05-01', 'Día del Trabajo',            true),
  ('2026-09-16', 'Día de la Independencia',   true),
  ('2026-11-16', 'Día de la Revolución',      true),
  ('2026-12-25', 'Navidad',                   true)
ON CONFLICT (date) DO NOTHING;

-- Seed 2027 statutory holidays (LFT-adjusted dates)
-- Jan 1, 2027 = Friday → Feb 1 = Monday (first Monday of Feb)
-- Mar 1 = Monday → third Monday = Mar 15
-- Nov 1 = Monday → third Monday = Nov 15
INSERT INTO public.company_holidays (date, name, is_statutory) VALUES
  ('2027-01-01', 'Año Nuevo',                 true),
  ('2027-02-01', 'Día de la Constitución',    true),
  ('2027-03-15', 'Natalicio de Benito Juárez',true),
  ('2027-05-01', 'Día del Trabajo',            true),
  ('2027-09-16', 'Día de la Independencia',   true),
  ('2027-11-15', 'Día de la Revolución',      true),
  ('2027-12-25', 'Navidad',                   true)
ON CONFLICT (date) DO NOTHING;

-- ── C. holiday_requests ───────────────────────────────────────────────────────

CREATE TYPE public.holiday_request_status AS ENUM
  ('approved', 'pending_tl', 'denied', 'cancelled');

CREATE TABLE public.holiday_requests (
  id           uuid                              PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  uuid        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  campaign_id  uuid        NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  holiday_date date        NOT NULL,
  holiday_name text        NOT NULL,  -- snapshot at request time, intentionally denormalized
  status       public.holiday_request_status NOT NULL DEFAULT 'pending_tl',
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at  timestamptz
);

ALTER TABLE public.holiday_requests ENABLE ROW LEVEL SECURITY;

-- Agents: read own requests
-- Uses my_employee_id() SECURITY DEFINER helper (avoids inline subquery on employees,
-- which can silently return empty if upstream RLS tightens — lesson from 20260423200001).
CREATE POLICY "holiday_requests_agent_select" ON public.holiday_requests
  FOR SELECT USING (employee_id = public.my_employee_id());

-- Agents: insert own requests
CREATE POLICY "holiday_requests_agent_insert" ON public.holiday_requests
  FOR INSERT WITH CHECK (employee_id = public.my_employee_id());

-- Agents: cancel own requests (status transition to 'cancelled' enforced in app layer)
CREATE POLICY "holiday_requests_agent_cancel" ON public.holiday_requests
  FOR UPDATE USING (employee_id = public.my_employee_id());

-- TL: read all requests for their team
CREATE POLICY "holiday_requests_tl_select" ON public.holiday_requests
  FOR SELECT USING (
    public.is_team_lead()
    AND public.tl_employee_on_my_team(employee_id)
  );

-- TL: approve/deny requests for their team (UPDATE only, no INSERT/DELETE)
CREATE POLICY "holiday_requests_tl_update" ON public.holiday_requests
  FOR UPDATE USING (
    public.is_team_lead()
    AND public.tl_employee_on_my_team(employee_id)
  );

-- HR/Leadership: full access
CREATE POLICY "holiday_requests_leadership_all" ON public.holiday_requests
  FOR ALL USING (public.is_leadership())
  WITH CHECK (public.is_leadership());

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
