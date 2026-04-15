-- 1. Add team_lead_id to campaigns
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS team_lead_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;

-- 2. Trigger: sync reports_to from campaign's TL when employee.campaign_id changes
CREATE OR REPLACE FUNCTION public.sync_reports_to_from_campaign()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  new_tl uuid;
BEGIN
  IF new.campaign_id IS NULL THEN
    new.reports_to := NULL;
    RETURN new;
  END IF;
  IF EXISTS (SELECT 1 FROM campaigns WHERE id = new.campaign_id AND team_lead_id = new.id) THEN
    RETURN new;
  END IF;
  SELECT team_lead_id INTO new_tl FROM campaigns WHERE id = new.campaign_id;
  new.reports_to := new_tl;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_reports_to_from_campaign ON public.employees;
CREATE TRIGGER trg_sync_reports_to_from_campaign
BEFORE INSERT OR UPDATE OF campaign_id ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.sync_reports_to_from_campaign();

-- 3. Trigger: cascade TL change to all campaign agents
CREATE OR REPLACE FUNCTION public.cascade_campaign_tl_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF new.team_lead_id IS DISTINCT FROM old.team_lead_id THEN
    UPDATE public.employees
    SET reports_to = new.team_lead_id
    WHERE campaign_id = new.id
      AND id != COALESCE(new.team_lead_id, '00000000-0000-0000-0000-000000000000');
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_campaign_tl_change ON public.campaigns;
CREATE TRIGGER trg_cascade_campaign_tl_change
AFTER UPDATE OF team_lead_id ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.cascade_campaign_tl_change();

-- 4. Backfill known TLs (cascade trigger fires, fixing all reports_to)
UPDATE public.campaigns SET team_lead_id = '59b1a0a9-efe9-4f8c-ba4e-753e9682951b'
  WHERE id = '0e30abfc-0f32-4c7f-85ba-3e81792963b7'; -- SLOC Weekday → Javier Caballero
UPDATE public.campaigns SET team_lead_id = '855591b2-3a3a-4fff-b88c-9d6d649ab2aa'
  WHERE id = '09a1953e-252a-4f01-b77d-cdeb89d6e005'; -- SLOC Weekend → Deysi Esperanza
UPDATE public.campaigns SET team_lead_id = 'f8050540-5702-45d9-89d7-8b9d31c052ad'
  WHERE id = '446419aa-4b46-410c-8be7-c02356429230'; -- MCA → Adrian Castillo
UPDATE public.campaigns SET team_lead_id = '81195d05-6d76-42dd-b842-b3d803829f9f'
  WHERE id = '3764095d-c716-41be-8077-be81e1312363'; -- Transfers → Ruben Curiel
UPDATE public.campaigns SET team_lead_id = 'e7715756-4f35-495e-9d24-4d5db4d7bb52'
  WHERE id = '45cc422b-0319-47a6-ae86-229f0d72e646'; -- Sales Agent → Wendy Mena

-- 5. Add email column to employees for tracking
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS email text;
