-- ============================================================
-- Migration: Split clients into clients + campaigns
-- 2026-04-14 — Decisions locked in with D
-- ============================================================

-- 1. Create campaigns table (client_id nullable initially for bootstrapping)
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow full access for authenticated" ON public.campaigns
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 2. Drop ALL FK constraints referencing clients(id)
ALTER TABLE public.employees            DROP CONSTRAINT IF EXISTS employees_client_id_fkey;
ALTER TABLE public.shift_settings       DROP CONSTRAINT IF EXISTS shift_settings_campaign_id_fkey;
ALTER TABLE public.campaign_kpi_config  DROP CONSTRAINT IF EXISTS campaign_kpi_config_campaign_id_fkey;
ALTER TABLE public.eod_logs             DROP CONSTRAINT IF EXISTS eod_logs_campaign_id_fkey;
ALTER TABLE public.shift_settings_audit DROP CONSTRAINT IF EXISTS shift_settings_audit_campaign_id_fkey;

-- 3. Insert preserved-UUID campaigns (same IDs as old clients rows)
INSERT INTO public.campaigns (id, name, created_at) VALUES
  ('0e30abfc-0f32-4c7f-85ba-3e81792963b7', 'SLOC Weekday', now()),
  ('09a1953e-252a-4f01-b77d-cdeb89d6e005', 'SLOC Weekend', now()),
  ('3764095d-c716-41be-8077-be81e1312363', 'Transfers',    now()),
  ('32a26428-0dfc-4782-b452-cd06232afebc', 'Designer',     now()),
  ('be308060-4492-45a7-9cb7-ad97d64561bf', 'Tech Support', now());

-- 4. Add employees.campaign_id, backfill from client_id, drop client_id
ALTER TABLE public.employees ADD COLUMN campaign_id uuid;
UPDATE public.employees SET campaign_id = client_id WHERE client_id IS NOT NULL;
ALTER TABLE public.employees DROP COLUMN client_id;

-- 5. Re-point FKs → campaigns(id)
ALTER TABLE public.shift_settings
  ADD CONSTRAINT shift_settings_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.campaign_kpi_config
  ADD CONSTRAINT campaign_kpi_config_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.eod_logs
  ADD CONSTRAINT eod_logs_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id);
ALTER TABLE public.shift_settings_audit
  ADD CONSTRAINT shift_settings_audit_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.employees
  ADD CONSTRAINT employees_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id);

-- 6. Clean up clients — remove campaign-shaped rows
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_prefix_key;
DELETE FROM public.clients WHERE id = '8ec3d4de-30db-4371-85e4-4e7014c0f2c7';
DELETE FROM public.clients WHERE id IN (
  '0e30abfc-0f32-4c7f-85ba-3e81792963b7','09a1953e-252a-4f01-b77d-cdeb89d6e005',
  '3764095d-c716-41be-8077-be81e1312363','32a26428-0dfc-4782-b452-cd06232afebc',
  'be308060-4492-45a7-9cb7-ad97d64561bf');

-- 7. Insert the 4 real clients
INSERT INTO public.clients (name, prefix, bill_to_name) VALUES
  ('Torro',             'TORRO', 'Torro Inc.'),
  ('Big Think Capital', 'BTC',   'Big Think Capital'),
  ('Scoop',             'SCOOP', 'Scoop Services Inc.'),
  ('HFB Tech',          'HFB',   'HFB Tech Solutions');
ALTER TABLE public.clients ADD CONSTRAINT clients_prefix_key UNIQUE (prefix);

-- 8. Set campaigns.client_id, add new campaigns, enforce NOT NULL + FK + unique
UPDATE public.campaigns SET client_id = (SELECT id FROM public.clients WHERE prefix = 'TORRO')
  WHERE name IN ('SLOC Weekday', 'SLOC Weekend');
UPDATE public.campaigns SET client_id = (SELECT id FROM public.clients WHERE prefix = 'BTC')
  WHERE name = 'Transfers';
UPDATE public.campaigns SET client_id = (SELECT id FROM public.clients WHERE prefix = 'HFB')
  WHERE name = 'Designer';
UPDATE public.campaigns SET client_id = (SELECT id FROM public.clients WHERE prefix = 'SCOOP')
  WHERE name = 'Tech Support';

INSERT INTO public.campaigns (client_id, name) VALUES
  ((SELECT id FROM public.clients WHERE prefix = 'TORRO'), 'MCA'),
  ((SELECT id FROM public.clients WHERE prefix = 'TORRO'), 'Underwriting'),
  ((SELECT id FROM public.clients WHERE prefix = 'TORRO'), 'Data Entry'),
  ((SELECT id FROM public.clients WHERE prefix = 'TORRO'), 'Decline'),
  ((SELECT id FROM public.clients WHERE prefix = 'SCOOP'), 'Sales CS'),
  ((SELECT id FROM public.clients WHERE prefix = 'HFB'),   'SEO Specialist'),
  ((SELECT id FROM public.clients WHERE prefix = 'HFB'),   'Sales Agent');

ALTER TABLE public.campaigns ALTER COLUMN client_id SET NOT NULL;
ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_client_id_name_key UNIQUE (client_id, name);

-- 9. Employee reassignments per roster
UPDATE public.employees SET campaign_id = '09a1953e-252a-4f01-b77d-cdeb89d6e005'
  WHERE full_name IN ('Angie Perez','Armando Vazquez','Carlos Pedro','Deysi Esperanza',
    'Jesse Vazquez','Jorge Delgado','Juan Jug','Aldo Gonzalez','Danny Torres');
UPDATE public.employees SET campaign_id = (SELECT id FROM public.campaigns WHERE name = 'MCA')
  WHERE full_name IN ('Adrian Castillo','Jorge Channon','Jorge Ibanez','Jorge Sandoval','Julia Nunez');
UPDATE public.employees SET campaign_id = (SELECT id FROM public.campaigns WHERE name = 'Underwriting')
  WHERE full_name IN ('Irving Fuentes','Mariana Perez','Luis Martinez');
UPDATE public.employees SET campaign_id = (SELECT id FROM public.campaigns WHERE name = 'Data Entry')
  WHERE full_name = 'Cesar Cardenas';
UPDATE public.employees SET campaign_id = (SELECT id FROM public.campaigns WHERE name = 'Decline')
  WHERE full_name = 'Sebastian Cordova';
UPDATE public.employees SET campaign_id = '3764095d-c716-41be-8077-be81e1312363'
  WHERE full_name IN ('Hannia Belem','Sofia Corrales','Mauricio Gomez','Rafael Ochoa');
UPDATE public.employees SET campaign_id = (SELECT id FROM public.campaigns WHERE name = 'Sales CS')
  WHERE full_name = 'Crystal Smith';
UPDATE public.employees SET campaign_id = (SELECT id FROM public.campaigns WHERE name = 'SEO Specialist')
  WHERE full_name = 'Ivana Herkommer';
UPDATE public.employees SET campaign_id = (SELECT id FROM public.campaigns WHERE name = 'Sales Agent')
  WHERE full_name IN ('Marisol Monroy','Wendy Mena');

-- 10. Renames
UPDATE public.employees SET full_name = 'Jacob Miller'   WHERE employee_id = 'EMP-049';
UPDATE public.employees SET full_name = 'Hannia Lopez'    WHERE employee_id = 'EMP-028';
UPDATE public.employees SET full_name = 'Sofia Gonzalez'  WHERE employee_id = 'EMP-027';
UPDATE public.employees SET full_name = 'Mauro Gomez'     WHERE employee_id = 'EMP-032';

-- 11. Deactivate roster-absent
UPDATE public.employees SET is_active = false, campaign_id = NULL
  WHERE employee_id IN ('EMP-052','EMP-050','EMP-018','EMP-039','EMP-040','EMP-030','EMP-033');

-- 12. Team Lead promotions
UPDATE public.employees SET title = 'team_lead'
  WHERE full_name IN ('Adrian Castillo','Deysi Esperanza');

-- 13. KPI redistribution
INSERT INTO public.campaign_kpi_config (campaign_id, field_name, field_label, field_type, display_order, is_active)
  SELECT '09a1953e-252a-4f01-b77d-cdeb89d6e005', field_name, field_label, field_type, display_order, is_active
  FROM public.campaign_kpi_config
  WHERE campaign_id = '0e30abfc-0f32-4c7f-85ba-3e81792963b7'
    AND field_name IN ('credit_pulls','approval_calls','scheduled_with_closers');
UPDATE public.campaign_kpi_config
  SET campaign_id = (SELECT id FROM public.campaigns WHERE name = 'MCA')
  WHERE campaign_id = '0e30abfc-0f32-4c7f-85ba-3e81792963b7'
    AND field_name IN ('packages_returned','calls_made');
DELETE FROM public.campaign_kpi_config
  WHERE campaign_id = '09a1953e-252a-4f01-b77d-cdeb89d6e005' AND field_name = 'calls';
UPDATE public.campaign_kpi_config
  SET campaign_id = (SELECT id FROM public.campaigns WHERE name = 'Sales Agent')
  WHERE campaign_id = '32a26428-0dfc-4782-b452-cd06232afebc'
    AND field_name IN ('sets_completed','calls_made');
UPDATE public.campaign_kpi_config
  SET campaign_id = (SELECT id FROM public.campaigns WHERE name = 'Sales CS')
  WHERE campaign_id = 'be308060-4492-45a7-9cb7-ad97d64561bf'
    AND field_name = 'reactivations';

-- 14. Shift settings — delete all and reseed
ALTER TABLE public.shift_settings DISABLE TRIGGER trg_shift_settings_audit;
DELETE FROM public.shift_settings;
INSERT INTO public.shift_settings (campaign_id, shift_name, start_time, end_time, grace_minutes, days_of_week) VALUES
  ('0e30abfc-0f32-4c7f-85ba-3e81792963b7', 'Default', '08:00','19:00', 10, '{1,2,3,4}'),
  ('09a1953e-252a-4f01-b77d-cdeb89d6e005', 'Default', '08:00','20:00', 10, '{5,6,0}'),
  ((SELECT id FROM public.campaigns WHERE name = 'MCA'),          'Default', '09:00','18:00', 10, '{1,2,3,4,5}'),
  ((SELECT id FROM public.campaigns WHERE name = 'Underwriting'), 'Default', '09:00','18:00', 10, '{1,2,3,4,5}'),
  ((SELECT id FROM public.campaigns WHERE name = 'Data Entry'),   'Default', '08:00','17:00', 10, '{1,2,3,4,5}'),
  ((SELECT id FROM public.campaigns WHERE name = 'Decline'),      'Default', '08:00','18:00', 10, '{1,2,3,4,5}'),
  ('3764095d-c716-41be-8077-be81e1312363', 'Default', '08:00','17:00', 10, '{1,2,3,4,5}'),
  ('be308060-4492-45a7-9cb7-ad97d64561bf', 'Default', '08:00','18:00', 10, '{1,2,3,4}'),
  ((SELECT id FROM public.campaigns WHERE name = 'Sales CS'),      'Default', '08:00','17:00', 10, '{1,2,3,4,5}'),
  ('32a26428-0dfc-4782-b452-cd06232afebc', 'Default', '09:00','18:00', 10, '{1,2,3,4,5}'),
  ((SELECT id FROM public.campaigns WHERE name = 'SEO Specialist'),'Default', '08:00','17:00', 10, '{1,2,3,4,5}'),
  ((SELECT id FROM public.campaigns WHERE name = 'Sales Agent'),   'Default', '09:00','17:00', 10, '{1,2,3,4,5}');
ALTER TABLE public.shift_settings ENABLE TRIGGER trg_shift_settings_audit;
