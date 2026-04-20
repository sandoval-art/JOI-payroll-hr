-- B1: Notes + verbal warnings — extend agent_coaching_notes
-- Adds entry_type, visible_to_agent, updated_at fields.
-- Drops TL update/delete policies (immutable after insert for legal defensibility).
-- Adds agent SELECT policy for entries marked visible_to_agent.

-- ── Schema changes ────────────────────────────────────────────────────
ALTER TABLE public.agent_coaching_notes
  ADD COLUMN IF NOT EXISTS entry_type text NOT NULL DEFAULT 'note'
    CHECK (entry_type IN ('note', 'verbal_warning')),
  ADD COLUMN IF NOT EXISTS visible_to_agent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- updated_at trigger (reuses existing set_updated_at() function)
CREATE TRIGGER trg_agent_coaching_notes_updated_at
  BEFORE UPDATE ON public.agent_coaching_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS changes ───────────────────────────────────────────────────────

-- Drop TL update/delete (entries are immutable after insert for legal defensibility)
DROP POLICY IF EXISTS "tl_update_coaching_notes" ON public.agent_coaching_notes;
DROP POLICY IF EXISTS "tl_delete_coaching_notes" ON public.agent_coaching_notes;

-- Agent can see entries marked visible_to_agent on their own record
CREATE POLICY "agent_select_visible_entries"
  ON public.agent_coaching_notes FOR SELECT TO authenticated
  USING (
    agent_id = public.my_employee_id()
    AND visible_to_agent = true
  );
