-- JOI-specific seed data — do NOT run on white-label deployments
-- Seeds 53 real employees for D's org (Torro, Big Think Capital, HFB, Scoop).
-- This file was moved out of supabase/migrations/ to prevent it from running on
-- every fresh deployment. The data is already present in the live JOI database.
-- Run manually via the Supabase SQL editor when bootstrapping a JOI-specific instance.
-- Created: 2026-04-13

-- CTE to map client prefixes to their IDs
with client_lookup as (
  select 'JOI' as prefix, id as client_id from public.clients where name = 'Torro'
  union all
  select 'BTC' as prefix, id as client_id from public.clients where name = 'Big Think Capital'
  union all
  select 'HFB' as prefix, id as client_id from public.clients where name = 'HFB'
  union all
  select 'SCO' as prefix, id as client_id from public.clients where name = 'Scoop'
),
-- Employee data with all required fields
employees_to_insert as (
  select
    'EMP-001'::text as employee_id,
    'Javier Caballero'::text as full_name,
    'JOI'::text as client_prefix,
    'L-V'::text as shift_type,
    true::boolean as is_active
  union all select 'EMP-002', 'Jose Ham', 'JOI', 'L-V', true
  union all select 'EMP-003', 'Alonso Landeros', 'JOI', 'L-V', true
  union all select 'EMP-004', 'Glenn Espinosa', 'JOI', 'L-V', true
  union all select 'EMP-005', 'Deysi Esperanza', 'JOI', 'V-D', true
  union all select 'EMP-006', 'Adrian Arechiga', 'JOI', 'L-V', true
  union all select 'EMP-007', 'Wendy Mena', 'HFB', 'L-V', true
  union all select 'EMP-008', 'Sebastian Cordova', 'JOI', 'L-V', true
  union all select 'EMP-009', 'Lydia Juarez', 'JOI', 'L-V', true
  union all select 'EMP-010', 'Aldo Gonzalez', 'JOI', 'V-D', true
  union all select 'EMP-011', 'Angie Perez', 'JOI', 'V-D', true
  union all select 'EMP-012', 'Carlos Pedro', 'JOI', 'V-D', true
  union all select 'EMP-013', 'Jorge Delgado', 'JOI', 'V-D', true
  union all select 'EMP-014', 'Armando Vazquez', 'JOI', 'V-D', true
  union all select 'EMP-015', 'Jesse Vazquez', 'JOI', 'V-D', true
  union all select 'EMP-016', 'Adrian Castillo', 'JOI', 'L-V', true
  union all select 'EMP-017', 'Jorge Channon', 'JOI', 'L-V', true
  union all select 'EMP-018', 'Javier Natividad', 'JOI', 'V-D', true
  union all select 'EMP-019', 'Jorge Ibanez', 'JOI', 'L-V', true
  union all select 'EMP-020', 'Julia Nunez', 'JOI', 'L-V', true
  union all select 'EMP-021', 'Jorge Sandoval', 'JOI', 'L-V', true
  union all select 'EMP-022', 'Mariana Perez', 'JOI', 'L-V', true
  union all select 'EMP-023', 'Irving Fuentes', 'JOI', 'L-V', true
  union all select 'EMP-024', 'Luis Martinez', 'JOI', 'V-D', true
  union all select 'EMP-025', 'Cesar Cardenas', 'JOI', 'L-V', true
  union all select 'EMP-026', 'Ruben Curiel', 'BTC', 'L-V', true
  union all select 'EMP-027', 'Sofia Corrales', 'HFB', 'L-V', true
  union all select 'EMP-028', 'Hannia Belem', 'HFB', 'L-V', true
  union all select 'EMP-029', 'Rafael Ochoa', 'BTC', 'L-V', true
  union all select 'EMP-030', 'Edgar Barron', 'BTC', 'L-V', false
  union all select 'EMP-031', 'Aldo Trujillo', 'BTC', 'L-V', true
  union all select 'EMP-032', 'Mauricio Gomez', 'BTC', 'L-V', true
  union all select 'EMP-033', 'Teresita Hernandez', 'BTC', 'L-V', false
  union all select 'EMP-034', 'Gustavo Medina', 'SCO', 'V-D', true
  union all select 'EMP-035', 'Charlie Farfan', 'SCO', 'L-V', true
  union all select 'EMP-036', 'Francisco Ascencio', 'HFB', 'L-V', true
  union all select 'EMP-037', 'Alex Navarro', 'JOI', 'L-V', true
  union all select 'EMP-038', 'Albert Vieyra', 'JOI', 'L-V', true
  union all select 'EMP-039', 'Jhon Rodriguez', 'JOI', 'V-D', false
  union all select 'EMP-040', 'Luis Ventura', 'JOI', 'L-V', false
  union all select 'EMP-041', 'Marisol Monroy', 'HFB', 'L-V', true
  union all select 'EMP-042', 'Paty Rodriguez', null, 'L-V', true
  union all select 'EMP-043', 'Juan Jug', 'JOI', 'V-D', true
  union all select 'EMP-044', 'Crystal Smith', 'SCO', 'L-V', true
  union all select 'EMP-045', 'Sebastian Munoz', 'JOI', 'L-V', true
  union all select 'EMP-046', 'Danny Torres', 'JOI', 'L-V', true
  union all select 'EMP-047', 'Lucia Castellanos', 'HFB', 'L-V', true
  union all select 'EMP-048', 'Cynthia Ostos', 'JOI', 'L-V', true
  union all select 'EMP-049', 'Santiago Valenzuela', 'JOI', 'L-V', true
  union all select 'EMP-050', 'Antonio Alvarez', 'JOI', 'V-D', true
  union all select 'EMP-051', 'Santiago Lopez', 'JOI', 'L-V', true
  union all select 'EMP-052', 'Andres Pedrazzini', 'JOI', 'V-D', true
  union all select 'EMP-053', 'Ivana Herkommer', 'HFB', 'L-V', true
)
insert into public.employees (
  employee_id,
  full_name,
  client_id,
  shift_type,
  monthly_base_salary,
  daily_discount_rate,
  kpi_bonus_amount,
  is_active
)
select
  eti.employee_id,
  eti.full_name,
  cl.client_id,
  eti.shift_type,
  0::numeric(12,2),
  0::numeric(12,2),
  0::numeric(12,2),
  eti.is_active
from employees_to_insert eti
left join client_lookup cl on eti.client_prefix = cl.prefix
on conflict (employee_id) do nothing;
