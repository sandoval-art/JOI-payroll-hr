

# Base de Datos Supabase para Nómina Pro

## Resumen
Crear 3 tablas en Supabase (`employees`, `payroll_periods`, `payroll_records`) con RLS habilitado, y luego migrar el frontend de Zustand/localStorage a queries de Supabase.

## Paso 1: Migración SQL

Crear las tres tablas con las especificaciones exactas solicitadas:

**`employees`** — Datos maestros de empleados con eliminación lógica (`is_active`).

**`payroll_periods`** — Periodos quincenales (Q1/Q2) con estado open/closed.

**`payroll_records`** — Registros de incidencias y resultado calculado por empleado/periodo, con constraint UNIQUE en `(employee_id, period_id)` para soportar upserts.

RLS habilitado en las 3 tablas con políticas permisivas para usuarios autenticados (entorno administrativo). Se usará `anon` temporalmente si no hay auth implementado.

## Paso 2: Políticas RLS

Como es un sistema administrativo sin autenticación implementada aún, se crearán políticas que permitan acceso completo a usuarios autenticados. Se informará al usuario que debe implementar autenticación para que RLS funcione correctamente.

## Paso 3: Actualizar tipos TypeScript

Los tipos se regeneran automáticamente al aplicar la migración. No se edita `types.ts` manualmente.

## Paso 4: Migrar el frontend a Supabase

- Crear hooks (`useEmployees`, `usePayrollPeriods`, `usePayrollRecords`) con React Query para CRUD contra Supabase.
- Actualizar `Dashboard.tsx`, `Empleados.tsx`, `EmpleadoPerfil.tsx`, `Historial.tsx` para usar los nuevos hooks en lugar del store Zustand.
- Mantener `calcularNomina` en el cliente para feedback instantáneo, pero persistir inputs y `calculated_net_pay` en `payroll_records`.
- Implementar upsert en `payroll_records` vinculado al periodo activo al editar incidencias.
- Adaptar carga masiva CSV para hacer bulk insert en `employees`.

## Paso 5: Mantener compatibilidad

- El store Zustand se puede mantener como cache local o eliminarse gradualmente.
- Los tipos del frontend (`Employee`, `PayrollConfig`, etc.) se alinearán con los nombres de columna de Supabase.

## Detalle técnico: SQL de migración

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. employees
create table public.employees (
  id uuid primary key default uuid_generate_v4(),
  employee_id text unique not null,
  full_name text not null,
  shift_type text check (shift_type in ('L-J','L-V','V-D','V-L')),
  monthly_base_salary numeric(12,2) default 0,
  daily_discount_rate numeric(12,2) default 0,
  kpi_bonus_amount numeric(12,2) default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 2. payroll_periods
create table public.payroll_periods (
  id uuid primary key default uuid_generate_v4(),
  start_date date not null,
  end_date date not null,
  period_type text check (period_type in ('Q1','Q2')) not null,
  status text check (status in ('open','closed')) default 'open',
  created_at timestamptz default now()
);

-- 3. payroll_records
create table public.payroll_records (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid references public.employees(id) on delete cascade not null,
  period_id uuid references public.payroll_periods(id) not null,
  days_absent integer default 0,
  extra_days_count integer default 0,
  kpi_achieved boolean default false,
  sunday_premium_applied boolean default false,
  holiday_worked boolean default false,
  additional_bonuses numeric(12,2) default 0,
  calculated_net_pay numeric(12,2),
  updated_at timestamptz default now(),
  unique(employee_id, period_id)
);

-- RLS policies (admin access for authenticated users)
alter table public.employees enable row level security;
alter table public.payroll_periods enable row level security;
alter table public.payroll_records enable row level security;

create policy "Allow full access to employees" on public.employees
  for all to authenticated using (true) with check (true);

create policy "Allow full access to payroll_periods" on public.payroll_periods
  for all to authenticated using (true) with check (true);

create policy "Allow full access to payroll_records" on public.payroll_records
  for all to authenticated using (true) with check (true);
```

## Nota importante
Actualmente no hay autenticación implementada. Las políticas RLS permiten acceso solo a usuarios autenticados, por lo que **será necesario implementar un sistema de login** para que las operaciones CRUD funcionen. Alternativamente, se pueden agregar políticas temporales para `anon` durante desarrollo.

