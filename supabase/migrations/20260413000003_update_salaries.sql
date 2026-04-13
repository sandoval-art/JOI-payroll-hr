-- Update employee salaries and KPI bonuses
-- Monthly base = weekly base * 4
-- Daily discount = weekly base / days per week (5 for weekday, 3 for weekend)

-- TORRO SLOC Weekday agents (weekly $3,000, KPI $1,500, daily discount = $3000/5 = $600)
UPDATE public.employees SET monthly_base_salary = 12000, kpi_bonus_amount = 1500, daily_discount_rate = 600
WHERE employee_id IN ('EMP-002','EMP-003','EMP-004','EMP-006','EMP-037','EMP-038','EMP-045','EMP-046','EMP-048','EMP-049','EMP-051');

-- TORRO SLOC Weekend agents (weekly $3,000, KPI $1,500, daily discount = $3000/3 = $1000)
UPDATE public.employees SET monthly_base_salary = 12000, kpi_bonus_amount = 1500, daily_discount_rate = 1000
WHERE employee_id IN ('EMP-010','EMP-011','EMP-013','EMP-014','EMP-015','EMP-018','EMP-039','EMP-043','EMP-050','EMP-052');

-- Carlos Pedro - TORRO SLOC Weekend (weekly $3,000, KPI $2,000)
UPDATE public.employees SET monthly_base_salary = 12000, kpi_bonus_amount = 2000, daily_discount_rate = 1000
WHERE employee_id = 'EMP-012';

-- TORRO Declines Weekday (weekly $3,000, KPI $1,500)
UPDATE public.employees SET monthly_base_salary = 12000, kpi_bonus_amount = 1500, daily_discount_rate = 600
WHERE employee_id IN ('EMP-008','EMP-009');

-- TORRO MCA Weekday (weekly $3,000, KPI $1,500)
UPDATE public.employees SET monthly_base_salary = 12000, kpi_bonus_amount = 1500, daily_discount_rate = 600
WHERE employee_id IN ('EMP-016','EMP-020','EMP-021');

-- Jorge Channon - TORRO MCA (weekly $3,000, KPI $2,250)
UPDATE public.employees SET monthly_base_salary = 12000, kpi_bonus_amount = 2250, daily_discount_rate = 600
WHERE employee_id = 'EMP-017';

-- Jorge Ibanez - TORRO MCA (weekly $3,500, KPI $2,000)
UPDATE public.employees SET monthly_base_salary = 14000, kpi_bonus_amount = 2000, daily_discount_rate = 700
WHERE employee_id = 'EMP-019';

-- TORRO UW Weekday (weekly $4,500, KPI $0)
UPDATE public.employees SET monthly_base_salary = 18000, kpi_bonus_amount = 0, daily_discount_rate = 900
WHERE employee_id IN ('EMP-022','EMP-023');

-- Luis Martinez - TORRO UW Weekend (weekly $4,500, KPI $0)
UPDATE public.employees SET monthly_base_salary = 18000, kpi_bonus_amount = 0, daily_discount_rate = 1500
WHERE employee_id = 'EMP-024';

-- Cesar Cardenas - TORRO Data Entry (weekly $5,500, KPI $0)
UPDATE public.employees SET monthly_base_salary = 22000, kpi_bonus_amount = 0, daily_discount_rate = 1100
WHERE employee_id = 'EMP-025';

-- Javier Caballero - TL SLOC Weekday (weekly $5,750, KPI $0)
UPDATE public.employees SET monthly_base_salary = 23000, kpi_bonus_amount = 0, daily_discount_rate = 1150
WHERE employee_id = 'EMP-001';

-- Deysi Esperanza - TL SLOC Weekend (weekly $5,750, KPI $0)
UPDATE public.employees SET monthly_base_salary = 23000, kpi_bonus_amount = 0, daily_discount_rate = 1917
WHERE employee_id = 'EMP-005';

-- Wendy Mena - TL HFB (weekly $5,000, KPI $0)
UPDATE public.employees SET monthly_base_salary = 20000, kpi_bonus_amount = 0, daily_discount_rate = 1000
WHERE employee_id = 'EMP-007';

-- Ruben Curiel - TL BTC (weekly $5,750, KPI $0)
UPDATE public.employees SET monthly_base_salary = 23000, kpi_bonus_amount = 0, daily_discount_rate = 1150
WHERE employee_id = 'EMP-026';

-- BTC Transfer Agents Weekday (weekly $4,500, KPI $0)
UPDATE public.employees SET monthly_base_salary = 18000, kpi_bonus_amount = 0, daily_discount_rate = 900
WHERE employee_id IN ('EMP-029','EMP-030','EMP-031','EMP-032','EMP-033');

-- HFB Appointment Setters (weekly $4,500, KPI $0)
UPDATE public.employees SET monthly_base_salary = 18000, kpi_bonus_amount = 0, daily_discount_rate = 900
WHERE employee_id IN ('EMP-027','EMP-028');

-- HFB Designers (weekly $4,500, KPI $0)
UPDATE public.employees SET monthly_base_salary = 18000, kpi_bonus_amount = 0, daily_discount_rate = 900
WHERE employee_id IN ('EMP-036','EMP-047','EMP-053');

-- Marisol Monroy - HFB Collection Agent (weekly $4,500, KPI $0)
UPDATE public.employees SET monthly_base_salary = 18000, kpi_bonus_amount = 0, daily_discount_rate = 900
WHERE employee_id = 'EMP-041';

-- Scoop agents Weekday (weekly $4,500, KPI $0)
UPDATE public.employees SET monthly_base_salary = 18000, kpi_bonus_amount = 0, daily_discount_rate = 900
WHERE employee_id IN ('EMP-035','EMP-044');

-- Gustavo Medina - Scoop Weekend (weekly $4,500, KPI $0)
UPDATE public.employees SET monthly_base_salary = 18000, kpi_bonus_amount = 0, daily_discount_rate = 1500
WHERE employee_id = 'EMP-034';

-- Paty Rodriguez - Admin (weekly $8,750, KPI $0)
UPDATE public.employees SET monthly_base_salary = 35000, kpi_bonus_amount = 0, daily_discount_rate = 1750
WHERE employee_id = 'EMP-042';

-- Alex Navarro - TORRO SLOC Weekday (weekly $3,000, KPI $1,500)
-- Already covered above in EMP-037

-- Luis Ventura - Inactive TORRO SLOC Weekday (weekly $3,000, KPI $1,500)
UPDATE public.employees SET monthly_base_salary = 12000, kpi_bonus_amount = 1500, daily_discount_rate = 600
WHERE employee_id = 'EMP-040';
