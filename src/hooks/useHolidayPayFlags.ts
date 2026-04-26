import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HolidayPayFlag {
  employeeId: string;
  holidayDate: string; // ISO date string e.g. "2026-05-01"
  holidayName: string;
}

/**
 * Finds employees who clocked in on a statutory holiday within the active
 * payroll period. Used by PayrollRun to surface the Holiday Pay Flag card.
 *
 * Strategy: fetch statutory company_holidays in the period, then fetch all
 * time_clock rows in the same window and match by date prefix client-side
 * (Supabase JS doesn't support cast-to-date filters directly).
 * Returns one flag per (employee, holiday) pair.
 */
export function useHolidayPayFlags(
  periodStart: string | undefined,
  periodEnd: string | undefined
) {
  return useQuery({
    queryKey: ["holiday-pay-flags", periodStart, periodEnd],
    enabled: !!periodStart && !!periodEnd,
    queryFn: async (): Promise<HolidayPayFlag[]> => {
      // 1. Get statutory holidays in the period
      const { data: holidays, error: hErr } = await supabase
        .from("company_holidays")
        .select("date, name")
        .eq("is_statutory", true)
        .gte("date", periodStart!)
        .lte("date", periodEnd!);
      if (hErr) throw hErr;
      if (!holidays || holidays.length === 0) return [];

      const holidayDates = holidays.map((h) => h.date as string);
      const holidayMap = Object.fromEntries(
        holidays.map((h) => [h.date as string, h.name as string])
      );

      // 2. Fetch all time_clock rows in the period (filter by date prefix client-side)
      const { data: allClocks, error: cErr } = await supabase
        .from("time_clock")
        .select("employee_id, clock_in")
        .gte("clock_in", periodStart!)
        .lte("clock_in", periodEnd! + "T23:59:59");
      if (cErr) throw cErr;

      // 3. Dedupe: one flag per (employee_id, holiday_date)
      const seen = new Set<string>();
      const flags: HolidayPayFlag[] = [];
      for (const row of allClocks ?? []) {
        const dateStr = (row.clock_in as string).slice(0, 10); // "YYYY-MM-DD"
        if (!holidayDates.includes(dateStr)) continue;
        const key = `${row.employee_id}|${dateStr}`;
        if (seen.has(key)) continue;
        seen.add(key);
        flags.push({
          employeeId: row.employee_id as string,
          holidayDate: dateStr,
          holidayName: holidayMap[dateStr],
        });
      }
      return flags;
    },
  });
}
