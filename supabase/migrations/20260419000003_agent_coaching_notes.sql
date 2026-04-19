-- ==========================================================================
-- agent_coaching_notes — TL/leadership private notes per agent
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.agent_coaching_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id   uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  note       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_coaching_notes_agent ON public.agent_coaching_notes (agent_id, created_at DESC);

ALTER TABLE public.agent_coaching_notes ENABLE ROW LEVEL SECURITY;

-- Leadership: full access
CREATE POLICY "leadership_all_coaching_notes"
  ON public.agent_coaching_notes FOR ALL TO authenticated
  USING (public.is_leadership())
  WITH CHECK (public.is_leadership());

-- TL: full CRUD on notes for agents on their campaigns
CREATE POLICY "tl_select_coaching_notes"
  ON public.agent_coaching_notes FOR SELECT TO authenticated
  USING (public.is_team_lead() AND campaign_id IN (SELECT public.my_tl_campaign_ids()));

CREATE POLICY "tl_insert_coaching_notes"
  ON public.agent_coaching_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_team_lead() AND campaign_id IN (SELECT public.my_tl_campaign_ids()));

CREATE POLICY "tl_update_coaching_notes"
  ON public.agent_coaching_notes FOR UPDATE TO authenticated
  USING (public.is_team_lead() AND campaign_id IN (SELECT public.my_tl_campaign_ids()));

CREATE POLICY "tl_delete_coaching_notes"
  ON public.agent_coaching_notes FOR DELETE TO authenticated
  USING (public.is_team_lead() AND campaign_id IN (SELECT public.my_tl_campaign_ids()));

-- Agents: NO policies = no access (cannot see their own coaching notes)
