/**
 * Multi-tenancy Phase 1 — Organizations foundation
 *
 * Purely additive. No existing behavior changes.
 *
 * 1. Creates public.organizations table with RLS.
 * 2. Adds organization_id FK column to public.user_profiles (nullable first).
 * 3. Creates public.my_org_id() SECURITY DEFINER helper.
 * 4. Seeds one org row for JOI and backfills all existing user_profiles rows.
 * 5. Tightens organization_id to NOT NULL after backfill.
 */

-- ---------------------------------------------------------------------------
-- 1. organizations table
-- ---------------------------------------------------------------------------
CREATE TABLE public.organizations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  slug       text        NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Defined after my_org_id() is created (step 3 below); forward reference is
-- fine because CREATE POLICY is not evaluated until query time.
CREATE POLICY "organizations_read_own" ON public.organizations
  FOR SELECT USING (id = public.my_org_id());

-- ---------------------------------------------------------------------------
-- 2. Add organization_id to user_profiles (nullable for now — backfilled in step 4)
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_profiles
  ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- 3. my_org_id() helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.user_profiles
  WHERE id = auth.uid()
$$;

GRANT EXECUTE ON FUNCTION public.my_org_id() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Seed JOI org and backfill existing user_profiles rows
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_org_id uuid;
BEGIN
  INSERT INTO public.organizations (name, slug)
    VALUES ('JOI', 'joi')
    RETURNING id INTO v_org_id;

  UPDATE public.user_profiles
    SET organization_id = v_org_id;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Tighten to NOT NULL now that every row has been backfilled
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_profiles
  ALTER COLUMN organization_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 6. Reload PostgREST schema cache
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
