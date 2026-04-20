-- B4: Attendance incident categorization
-- Lets TL/HR categorize absences and late arrivals with a reason
-- and optional supporting document.

-- ── Table ─────────────────────────────────────────────────────────────
CREATE TABLE public.attendance_incidents (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       uuid        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date              date        NOT NULL,
  incident_type     text        NOT NULL
                    CHECK (incident_type IN ('late', 'sick', 'no_call_no_show', 'medical_leave', 'personal', 'bereavement', 'other')),
  notes             text,
  supporting_doc_path text,
  created_by        uuid        NOT NULL REFERENCES public.employees(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (employee_id, date)
);

CREATE INDEX idx_attendance_incidents_employee
  ON public.attendance_incidents (employee_id, date DESC);

CREATE TRIGGER trg_attendance_incidents_updated_at
  BEFORE UPDATE ON public.attendance_incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────
ALTER TABLE public.attendance_incidents ENABLE ROW LEVEL SECURITY;

-- Leadership: full access
CREATE POLICY "leadership_all_attendance_incidents"
  ON public.attendance_incidents FOR ALL TO authenticated
  USING (public.is_leadership())
  WITH CHECK (public.is_leadership());

-- TL: SELECT own team
CREATE POLICY "tl_select_team_incidents"
  ON public.attendance_incidents FOR SELECT TO authenticated
  USING (
    public.is_team_lead()
    AND employee_id IN (
      SELECT e.id FROM public.employees e
      WHERE e.campaign_id IN (SELECT public.my_tl_campaign_ids())
    )
  );

-- TL: INSERT own team
CREATE POLICY "tl_insert_team_incidents"
  ON public.attendance_incidents FOR INSERT TO authenticated
  WITH CHECK (
    public.is_team_lead()
    AND employee_id IN (
      SELECT e.id FROM public.employees e
      WHERE e.campaign_id IN (SELECT public.my_tl_campaign_ids())
    )
    AND created_by = public.my_employee_id()
  );

-- TL: UPDATE own team
CREATE POLICY "tl_update_team_incidents"
  ON public.attendance_incidents FOR UPDATE TO authenticated
  USING (
    public.is_team_lead()
    AND employee_id IN (
      SELECT e.id FROM public.employees e
      WHERE e.campaign_id IN (SELECT public.my_tl_campaign_ids())
    )
  )
  WITH CHECK (
    public.is_team_lead()
    AND employee_id IN (
      SELECT e.id FROM public.employees e
      WHERE e.campaign_id IN (SELECT public.my_tl_campaign_ids())
    )
  );

-- Agent: can see own incidents
CREATE POLICY "agents_select_own_incidents"
  ON public.attendance_incidents FOR SELECT TO authenticated
  USING (employee_id = public.my_employee_id());

-- NO DELETE policy — preserve history
