-- EOD Form Builder: extend campaign_kpi_config to support text and dropdown field types

-- 1. Drop the existing check constraint on field_type
alter table public.campaign_kpi_config
  drop constraint if exists campaign_kpi_config_field_type_check;

-- 2. Add it back with the four supported types
alter table public.campaign_kpi_config
  add constraint campaign_kpi_config_field_type_check
  check (field_type in ('number', 'boolean', 'text', 'dropdown'));

-- 3. Add dropdown_options column (null for non-dropdown fields)
alter table public.campaign_kpi_config
  add column if not exists dropdown_options text[] default null;

-- 4. Add is_required column (default false so existing rows are unaffected)
alter table public.campaign_kpi_config
  add column if not exists is_required boolean default false;
