import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { todayLocal } from "@/lib/localDate";

/* ------------------------------------------------------------------ */
/*  Shared local types                                                 */
/* ------------------------------------------------------------------ */

interface TeamMember {
  id: string;
  employee_id: string;
  full_name: string;
  title: string | null;
  campaign_id: string | null;
  campaigns: { name: string } | null;
}

interface ShiftSettings {
  id: string;
  campaign_id: string;
  shift_name: string;
  start_time: string; // "HH:MM:SS"
  end_time: string;
  grace_minutes: number;
  days_of_week: number[];
}

interface TimeClockRow {
  id: string;
  employee_id: string;
  clock_in: string;
  clock_out: string | null;
  date: string;
  is_late: boolean;
  late_minutes: number | null;
}

interface TimeOffRow {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
}

interface EODLogRow {
  id: string;
  employee_id: string;
  date: string;
  metrics: Record<string, unknown> | null;
}

/* ------------------------------------------------------------------ */
/*  Helper: format a Date as YYYY-MM-DD (local)                        */
/* ------------------------------------------------------------------ */

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ================================================================== */
/*  Hook 1 – useTeamRoster                                             */
/* ================================================================== */

export function useTeamRoster(tlEmployeeId: string | null) {
  return useQuery({
    queryKey: ["team-roster", tlEmployeeId],
    queryFn: async () => {
      if (!tlEmployeeId) return [];

      // Query the view (no salary columns) instead of the base table.
      // The view has no FK so we can't use PostgREST joins; fetch
      // campaign names in a second query and merge in memory.
      const { data: rows, error } = await supabase
        .from("employees_no_pay")
        .select("id, employee_id, full_name, title, campaign_id")
        .eq("reports_to", tlEmployeeId)
        .eq("is_active", true);
      if (error) throw error;
      if (!rows || rows.length === 0) return [];

      const campaignIds = [...new Set(rows.map((r) => r.campaign_id).filter(Boolean))] as string[];
      let campaignMap = new Map<string, string>();
      if (campaignIds.length > 0) {
        const { data: camps, error: campErr } = await supabase
          .from("campaigns")
          .select("id, name")
          .in("id", campaignIds);
        if (campErr) throw campErr;
        for (const c of camps || []) {
          campaignMap.set(c.id, c.name);
        }
      }

      return rows.map((r) => ({
        ...r,
        campaigns: r.campaign_id ? { name: campaignMap.get(r.campaign_id) ?? "" } : null,
      })) as unknown as TeamMember[];
    },
    enabled: !!tlEmployeeId,
  });
}

/* ================================================================== */
/*  Hook 2 – useTodayTimeclockStatus                                   */
/* ================================================================== */

export type TimeclockStatus =
  | "present"
  | "late"
  | "absent"
  | "expected"
  | "completed"
  | "day_off";

export interface TimeclockStatusRow {
  employeeId: string;
  fullName: string;
  status: TimeclockStatus;
  clockInTime: string | null;
  scheduledStart: string | null;
}

export function useTodayTimeclockStatus(tlEmployeeId: string | null) {
  return useQuery({
    queryKey: ["team-timeclock-today", tlEmployeeId],
    queryFn: async (): Promise<TimeclockStatusRow[]> => {
      if (!tlEmployeeId) return [];

      // 1. Team roster
      const { data: roster, error: rosterErr } = await supabase
        .from("employees_no_pay")
        .select("id, full_name, campaign_id")
        .eq("reports_to", tlEmployeeId)
        .eq("is_active", true);
      if (rosterErr) throw rosterErr;
      const members = (roster || []) as { id: string; full_name: string; campaign_id: string | null }[];
      if (members.length === 0) return [];

      const memberIds = members.map((m) => m.id);

      // 2. Today's time_clock rows
      const today = todayLocal();
      const { data: tcRows, error: tcErr } = await supabase
        .from("time_clock")
        .select("id, employee_id, clock_in, clock_out, date, is_late, late_minutes")
        .in("employee_id", memberIds)
        .eq("date", today);
      if (tcErr) throw tcErr;
      const clockRows = (tcRows || []) as TimeClockRow[];

      // 3. Shift settings for team campaigns
      const campaignIds = [...new Set(members.map((m) => m.campaign_id).filter(Boolean))] as string[];
      let shiftMap = new Map<string, ShiftSettings>();
      if (campaignIds.length > 0) {
        const { data: shifts, error: shiftErr } = await supabase
          .from("shift_settings")
          .select("id, campaign_id, shift_name, start_time, end_time, grace_minutes, days_of_week")
          .in("campaign_id", campaignIds);
        if (shiftErr) throw shiftErr;
        for (const s of (shifts || []) as ShiftSettings[]) {
          shiftMap.set(s.campaign_id, s);
        }
      }

      // 4. Compute status for each member
      const now = new Date();
      const todayDow = new Date(today + "T00:00:00").getDay(); // 0=Sun

      return members.map((m) => {
        const shift = m.campaign_id ? shiftMap.get(m.campaign_id) : undefined;
        const clockRow = clockRows.find((r) => r.employee_id === m.id);
        const startTime = shift?.start_time ?? null;

        // Determine if today is a workday
        const isWorkday = shift ? shift.days_of_week.includes(todayDow) : true; // default to workday if no shift

        if (!isWorkday) {
          return {
            employeeId: m.id,
            fullName: m.full_name,
            status: "day_off" as TimeclockStatus,
            clockInTime: clockRow?.clock_in ?? null,
            scheduledStart: startTime,
          };
        }

        // Parse scheduled start into today's date
        let scheduled: Date | null = null;
        let graceDeadline: Date | null = null;
        let absentDeadline: Date | null = null;
        const graceMinutes = shift?.grace_minutes ?? 0;

        if (startTime) {
          const [h, mn] = startTime.split(":").map(Number);
          scheduled = new Date(now);
          scheduled.setHours(h, mn, 0, 0);
          graceDeadline = new Date(scheduled.getTime() + graceMinutes * 60000);
          absentDeadline = new Date(scheduled.getTime() + (graceMinutes + 60) * 60000);
        }

        // Clocked out -> completed
        if (clockRow?.clock_out) {
          return {
            employeeId: m.id,
            fullName: m.full_name,
            status: "completed" as TimeclockStatus,
            clockInTime: clockRow.clock_in,
            scheduledStart: startTime,
          };
        }

        // Clocked in
        if (clockRow) {
          const clockInTime = new Date(clockRow.clock_in);
          const isLate = graceDeadline ? clockInTime > graceDeadline : false;
          return {
            employeeId: m.id,
            fullName: m.full_name,
            status: isLate ? ("late" as TimeclockStatus) : ("present" as TimeclockStatus),
            clockInTime: clockRow.clock_in,
            scheduledStart: startTime,
          };
        }

        // Not clocked in
        if (absentDeadline && now > absentDeadline) {
          return {
            employeeId: m.id,
            fullName: m.full_name,
            status: "absent" as TimeclockStatus,
            clockInTime: null,
            scheduledStart: startTime,
          };
        }
        if (graceDeadline && now > graceDeadline) {
          return {
            employeeId: m.id,
            fullName: m.full_name,
            status: "late" as TimeclockStatus,
            clockInTime: null,
            scheduledStart: startTime,
          };
        }
        return {
          employeeId: m.id,
          fullName: m.full_name,
          status: "expected" as TimeclockStatus,
          clockInTime: null,
          scheduledStart: startTime,
        };
      });
    },
    enabled: !!tlEmployeeId,
    refetchInterval: 30000,
  });
}

/* ================================================================== */
/*  Hook 3 – usePendingTimeOffForTeam                                  */
/* ================================================================== */

export interface PendingTimeOff extends TimeOffRow {
  fullName: string;
}

export function usePendingTimeOffForTeam(tlEmployeeId: string | null) {
  return useQuery({
    queryKey: ["team-timeoff-pending", tlEmployeeId],
    queryFn: async (): Promise<PendingTimeOff[]> => {
      if (!tlEmployeeId) return [];

      // 1. Get team member IDs + names
      const { data: roster, error: rosterErr } = await supabase
        .from("employees_no_pay")
        .select("id, full_name")
        .eq("reports_to", tlEmployeeId)
        .eq("is_active", true);
      if (rosterErr) throw rosterErr;
      const members = (roster || []) as { id: string; full_name: string }[];
      if (members.length === 0) return [];

      const memberIds = members.map((m) => m.id);
      const nameMap = new Map(members.map((m) => [m.id, m.full_name]));

      // 2. Fetch pending time_off_requests
      const { data: requests, error: reqErr } = await supabase
        .from("time_off_requests")
        .select("id, employee_id, start_date, end_date, reason, status")
        .in("employee_id", memberIds)
        .eq("status", "pending");
      if (reqErr) throw reqErr;

      return ((requests || []) as TimeOffRow[]).map((r) => ({
        ...r,
        fullName: nameMap.get(r.employee_id) ?? "Unknown",
      }));
    },
    enabled: !!tlEmployeeId,
  });
}

/* ================================================================== */
/*  Hook 4 – useTeamEODThisWeek                                        */
/* ================================================================== */

export interface TeamEODSummary {
  employeeId: string;
  fullName: string;
  submissions: number;
  metrics: Record<string, number>;
  isTopPerformer: boolean;
  isBottomPerformer: boolean;
}

export function useTeamEODThisWeek(tlEmployeeId: string | null) {
  return useQuery({
    queryKey: ["team-eod-week", tlEmployeeId],
    queryFn: async (): Promise<TeamEODSummary[]> => {
      if (!tlEmployeeId) return [];

      // 1. Team roster
      const { data: roster, error: rosterErr } = await supabase
        .from("employees_no_pay")
        .select("id, full_name")
        .eq("reports_to", tlEmployeeId)
        .eq("is_active", true);
      if (rosterErr) throw rosterErr;
      const members = (roster || []) as { id: string; full_name: string }[];
      if (members.length === 0) return [];

      const memberIds = members.map((m) => m.id);

      // 2. Compute Monday–Sunday of current week
      const todayDate = new Date(todayLocal() + "T00:00:00");
      const monday = new Date(todayDate);
      monday.setDate(todayDate.getDate() - ((todayDate.getDay() + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const mondayStr = fmtDate(monday);
      const sundayStr = fmtDate(sunday);

      // 3. Fetch eod_logs in range
      const { data: logs, error: logErr } = await supabase
        .from("eod_logs")
        .select("id, employee_id, date, metrics")
        .in("employee_id", memberIds)
        .gte("date", mondayStr)
        .lte("date", sundayStr);
      if (logErr) throw logErr;
      const eodLogs = (logs || []) as EODLogRow[];

      // 4. Aggregate per member
      const summaries: TeamEODSummary[] = members.map((m) => {
        const myLogs = eodLogs.filter((l) => l.employee_id === m.id);
        const metricsTotals: Record<string, number> = {};

        for (const log of myLogs) {
          if (log.metrics && typeof log.metrics === "object") {
            for (const [key, val] of Object.entries(log.metrics)) {
              const num = typeof val === "number" ? val : parseFloat(String(val));
              if (!isNaN(num)) {
                metricsTotals[key] = (metricsTotals[key] ?? 0) + num;
              }
            }
          }
        }

        return {
          employeeId: m.id,
          fullName: m.full_name,
          submissions: myLogs.length,
          metrics: metricsTotals,
          isTopPerformer: false,
          isBottomPerformer: false,
        };
      });

      // Determine top/bottom by total of first numeric metric key
      if (summaries.length > 1) {
        const allKeys = [...new Set(summaries.flatMap((s) => Object.keys(s.metrics)))];
        if (allKeys.length > 0) {
          const primaryKey = allKeys[0];
          let maxVal = -Infinity;
          let minVal = Infinity;
          let maxIdx = -1;
          let minIdx = -1;

          summaries.forEach((s, i) => {
            const val = s.metrics[primaryKey] ?? 0;
            if (val > maxVal) { maxVal = val; maxIdx = i; }
            if (val < minVal) { minVal = val; minIdx = i; }
          });

          if (maxIdx >= 0) summaries[maxIdx].isTopPerformer = true;
          if (minIdx >= 0 && minIdx !== maxIdx) summaries[minIdx].isBottomPerformer = true;
        }
      }

      return summaries;
    },
    enabled: !!tlEmployeeId,
  });
}

/* ================================================================== */
/*  Hook 5 – useUnderperformerAlerts                                   */
/* ================================================================== */

export interface UnderperformerAlert {
  employeeId: string;
  fullName: string;
  reason: string;
}

export function useUnderperformerAlerts(tlEmployeeId: string | null) {
  return useQuery({
    queryKey: ["team-underperformer-alerts", tlEmployeeId],
    queryFn: async (): Promise<UnderperformerAlert[]> => {
      if (!tlEmployeeId) return [];

      // 1. Team roster with campaign_id
      const { data: roster, error: rosterErr } = await supabase
        .from("employees_no_pay")
        .select("id, full_name, campaign_id")
        .eq("reports_to", tlEmployeeId)
        .eq("is_active", true);
      if (rosterErr) throw rosterErr;
      const members = (roster || []) as { id: string; full_name: string; campaign_id: string | null }[];
      if (members.length === 0) return [];

      const memberIds = members.map((m) => m.id);

      // 2. Shift settings for team campaigns
      const campaignIds = [...new Set(members.map((m) => m.campaign_id).filter(Boolean))] as string[];
      const shiftMap = new Map<string, ShiftSettings>();
      if (campaignIds.length > 0) {
        const { data: shifts, error: shiftErr } = await supabase
          .from("shift_settings")
          .select("id, campaign_id, shift_name, start_time, end_time, grace_minutes, days_of_week")
          .in("campaign_id", campaignIds);
        if (shiftErr) throw shiftErr;
        for (const s of (shifts || []) as ShiftSettings[]) {
          shiftMap.set(s.campaign_id, s);
        }
      }

      // Date range: last 14 calendar days
      const todayDate = new Date(todayLocal() + "T00:00:00");
      const fourteenAgo = new Date(todayDate);
      fourteenAgo.setDate(todayDate.getDate() - 14);
      const fromStr = fmtDate(fourteenAgo);
      const toStr = todayLocal();

      // 3. EOD logs in last 14 days
      const { data: eodData, error: eodErr } = await supabase
        .from("eod_logs")
        .select("id, employee_id, date")
        .in("employee_id", memberIds)
        .gte("date", fromStr)
        .lte("date", toStr);
      if (eodErr) throw eodErr;
      const eodLogs = (eodData || []) as { id: string; employee_id: string; date: string }[];

      // 4. Late clock-ins in last 14 days
      const { data: lateData, error: lateErr } = await supabase
        .from("time_clock")
        .select("id, employee_id")
        .in("employee_id", memberIds)
        .eq("is_late", true)
        .gte("date", fromStr)
        .lte("date", toStr);
      if (lateErr) throw lateErr;
      const lateRows = (lateData || []) as { id: string; employee_id: string }[];

      // Count lates per employee
      const lateCountMap = new Map<string, number>();
      for (const row of lateRows) {
        lateCountMap.set(row.employee_id, (lateCountMap.get(row.employee_id) ?? 0) + 1);
      }

      // Count EOD submissions per employee
      const eodCountMap = new Map<string, number>();
      for (const log of eodLogs) {
        eodCountMap.set(log.employee_id, (eodCountMap.get(log.employee_id) ?? 0) + 1);
      }

      const alerts: UnderperformerAlert[] = [];

      for (const m of members) {
        // Count scheduled workdays in the last 14 calendar days
        const shift = m.campaign_id ? shiftMap.get(m.campaign_id) : undefined;
        const daysOfWeek = shift?.days_of_week ?? [1, 2, 3, 4, 5]; // default Mon-Fri
        let scheduledWorkdays = 0;
        for (let d = new Date(fourteenAgo); d <= todayDate; d.setDate(d.getDate() + 1)) {
          if (daysOfWeek.includes(d.getDay())) scheduledWorkdays++;
        }

        const eodCount = eodCountMap.get(m.id) ?? 0;
        if (scheduledWorkdays - eodCount > 2) {
          alerts.push({
            employeeId: m.id,
            fullName: m.full_name,
            reason: "Missed EOD",
          });
        }

        const lateCount = lateCountMap.get(m.id) ?? 0;
        if (lateCount > 3) {
          alerts.push({
            employeeId: m.id,
            fullName: m.full_name,
            reason: "Frequently late",
          });
        }
      }

      return alerts;
    },
    enabled: !!tlEmployeeId,
  });
}
