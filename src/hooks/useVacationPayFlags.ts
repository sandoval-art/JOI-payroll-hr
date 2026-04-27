import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VacationPayFlag {
  employeeId: string;
  startDate: string;   // ISO date
  endDate: string;     // ISO date
  daysInPeriod: number; // vacation days that fall within the payroll period
}

/**
 * Finds approved vacation requests overlapping the active payroll period.
 * Used by PayrollRun to surface the Prima Vacacional flag card.
 *
 * Days are clamped to the period boundary so partial overlaps report
 * only the days actually falling within the period.
 */
export function useVacationPayFlags(
  periodStart: string | undefined,
  periodEnd: string | undefined
) {
  return useQuery({
    queryKey: ["vacation-pay-flags", periodStart, periodEnd],
    enabled: !!periodStart && !!periodEnd,
    queryFn: async (): Promise<VacationPayFlag[]> => {
      // Fetch approved vacation requests overlapping the period
      const { data, error } = await supabase
        .from("vacation_requests")
        .select("employee_id, start_date, end_date, days_requested")
        .eq("status", "approved")
        .lte("start_date", periodEnd!)
        .gte("end_date", periodStart!);
      if (error) throw error;
      if (!data || data.length === 0) return [];

      return data.map((row) => {
        // Clamp vacation dates to the payroll period to get overlapping days
        const overlapStart = row.start_date > periodStart! ? row.start_date : periodStart!;
        const overlapEnd   = row.end_date < periodEnd!     ? row.end_date   : periodEnd!;
        const start = new Date(overlapStart);
        const end   = new Date(overlapEnd);
        const daysInPeriod = Math.max(1,
          Math.round((end.getTime() - start.getTime()) / 86400000) + 1
        );
        return {
          employeeId: row.employee_id as string,
          startDate:  row.start_date as string,
          endDate:    row.end_date as string,
          daysInPeriod,
        };
      });
    },
  });
}
