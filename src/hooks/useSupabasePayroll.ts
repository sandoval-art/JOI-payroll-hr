import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Employee, Turno, PayrollConfig, PayrollResult } from "@/types/payroll";
import { calcularNomina } from "@/types/payroll";

// Shift type mapping between frontend and DB
const shiftToDb: Record<Turno, string> = {
  "Lunes-Jueves": "L-J",
  "Lunes-Viernes": "L-V",
  "Viernes-Domingo": "V-D",
  "Viernes-Lunes": "V-L",
};
const shiftFromDb: Record<string, Turno> = {
  "L-J": "Lunes-Jueves",
  "L-V": "Lunes-Viernes",
  "V-D": "Viernes-Domingo",
  "V-L": "Viernes-Lunes",
};

// Map DB row to frontend Employee
function mapEmployee(row: any): Employee & { _clientId?: string } {
  return {
    id: row.employee_id,
    nombre: row.full_name,
    sueldoBase: Number(row.monthly_base_salary) || 0,
    descuentoPorDia: Number(row.daily_discount_rate) || 0,
    kpiMonto: Number(row.kpi_bonus_amount) || 0,
    turno: shiftFromDb[row.shift_type] || "Lunes-Viernes",
    _uuid: row.id,
    _clientId: row.client_id || undefined,
  };
}

// =================== EMPLOYEES ===================

export function useEmployees() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []).map(mapEmployee);
    },
  });
}

export function useAddEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (emp: Omit<Employee, "_uuid">) => {
      const { error } = await supabase.from("employees").insert({
        employee_id: emp.id,
        full_name: emp.nombre,
        shift_type: shiftToDb[emp.turno],
        monthly_base_salary: emp.sueldoBase,
        daily_discount_rate: emp.descuentoPorDia,
        kpi_bonus_amount: emp.kpiMonto,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useAddEmployeesBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (emps: Omit<Employee, "_uuid">[]) => {
      const rows = emps.map((e) => ({
        employee_id: e.id,
        full_name: e.nombre,
        shift_type: shiftToDb[e.turno],
        monthly_base_salary: e.sueldoBase,
        daily_discount_rate: e.descuentoPorDia,
        kpi_bonus_amount: e.kpiMonto,
      }));
      const { error } = await supabase.from("employees").upsert(rows, {
        onConflict: "employee_id",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeId, data }: { employeeId: string; data: Partial<Employee> }) => {
      const update: any = {};
      if (data.nombre !== undefined) update.full_name = data.nombre;
      if (data.sueldoBase !== undefined) update.monthly_base_salary = data.sueldoBase;
      if (data.descuentoPorDia !== undefined) update.daily_discount_rate = data.descuentoPorDia;
      if (data.kpiMonto !== undefined) update.kpi_bonus_amount = data.kpiMonto;
      if (data.turno !== undefined) update.shift_type = shiftToDb[data.turno];
      const { error } = await supabase
        .from("employees")
        .update(update)
        .eq("employee_id", employeeId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useRemoveEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (employeeId: string) => {
      // Soft delete
      const { error } = await supabase
        .from("employees")
        .update({ is_active: false })
        .eq("employee_id", employeeId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

// =================== PAYROLL PERIODS ===================

export function useActivePeriod() {
  return useQuery({
    queryKey: ["activePeriod"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_periods")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCreatePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (period: { start_date: string; end_date: string; period_type: string }) => {
      const { data, error } = await supabase
        .from("payroll_periods")
        .insert(period)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activePeriod"] }),
  });
}

export function useClosePeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (periodId: string) => {
      const { error } = await supabase
        .from("payroll_periods")
        .update({ status: "closed" })
        .eq("id", periodId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activePeriod"] });
      qc.invalidateQueries({ queryKey: ["payrollRecords"] });
      qc.invalidateQueries({ queryKey: ["closedPeriods"] });
    },
  });
}

// =================== PAYROLL RECORDS ===================

export function usePayrollRecords(periodId: string | undefined) {
  return useQuery({
    queryKey: ["payrollRecords", periodId],
    enabled: !!periodId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_records")
        .select("*")
        .eq("period_id", periodId!);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useUpsertPayrollRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (record: {
      employee_id: string; // DB uuid
      period_id: string;
      days_absent?: number;
      extra_days_count?: number;
      kpi_achieved?: boolean;
      sunday_premium_applied?: boolean;
      holiday_worked?: boolean;
      additional_bonuses?: number;
      calculated_net_pay?: number;
    }) => {
      const { error } = await supabase
        .from("payroll_records")
        .upsert(
          { ...record, updated_at: new Date().toISOString() },
          { onConflict: "employee_id,period_id" }
        );
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["payrollRecords", vars.period_id] });
    },
  });
}

// =================== HISTORY (closed periods) ===================

export function useClosedPeriods() {
  return useQuery({
    queryKey: ["closedPeriods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_periods")
        .select("*")
        .eq("status", "closed")
        .order("end_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useHistoryRecords() {
  return useQuery({
    queryKey: ["historyRecords"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_records")
        .select(`
          *,
          employees!inner(employee_id, full_name, monthly_base_salary, daily_discount_rate, kpi_bonus_amount, shift_type),
          payroll_periods!inner(start_date, end_date, period_type, status)
        `)
        .eq("payroll_periods.status", "closed")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

// =================== HELPERS ===================

export function getCurrentPeriodDates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  if (day <= 15) {
    return {
      start_date: `${year}-${String(month + 1).padStart(2, "0")}-01`,
      end_date: `${year}-${String(month + 1).padStart(2, "0")}-15`,
      period_type: "Q1" as const,
    };
  } else {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return {
      start_date: `${year}-${String(month + 1).padStart(2, "0")}-16`,
      end_date: `${year}-${String(month + 1).padStart(2, "0")}-${lastDay}`,
      period_type: "Q2" as const,
    };
  }
}

export function formatPeriodLabel(period: { start_date: string; end_date: string } | null): string {
  if (!period) return "Sin periodo activo";
  const start = new Date(period.start_date + "T12:00:00");
  const end = new Date(period.end_date + "T12:00:00");
  const month = start.toLocaleString("es-MX", { month: "long" });
  const year = start.getFullYear();
  return `${start.getDate()}-${end.getDate()} ${month} ${year}`;
}

/** Build a PayrollConfig from a DB payroll_record row */
export function recordToConfig(row: any, employeeId: string): PayrollConfig {
  return {
    empleadoId: employeeId,
    diasFaltados: row?.days_absent ?? 0,
    kpiAplicado: row?.kpi_achieved ?? false,
    diasExtra: row?.extra_days_count ?? 0,
    primaDominical: row?.sunday_premium_applied ?? false,
    diaFestivo: row?.holiday_worked ?? false,
    bonosAdicionales: Number(row?.additional_bonuses) || 0,
  };
}
