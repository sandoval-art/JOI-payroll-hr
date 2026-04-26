import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { todayLocal } from "@/lib/localDate";
import { getDisplayName } from "@/lib/displayName";

export interface HolidayRequest {
  id: string;
  employee_id: string;
  campaign_id: string;
  holiday_date: string;   // ISO date string
  holiday_name: string;
  status: "approved" | "pending_tl" | "denied" | "cancelled";
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface HolidayCapacity {
  approved_count: number;
  cap: number;
}

const REQUESTS_KEY = "holidayRequests";
const CAPACITIES_KEY = "holidayCapacities";

// ── useMyHolidayRequests ──────────────────────────────────────────────────────
// Reads the agent's own holiday_requests rows ordered by holiday_date asc.
// RLS scopes this to their own rows automatically.

export function useMyHolidayRequests(employeeId: string | null | undefined) {
  return useQuery({
    queryKey: [REQUESTS_KEY, employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from("holiday_requests")
        .select("*")
        .eq("employee_id", employeeId)
        .order("holiday_date", { ascending: true });
      if (error) throw error;
      return (data || []) as HolidayRequest[];
    },
    enabled: !!employeeId,
  });
}

// ── useCampaignHolidayCapacities ──────────────────────────────────────────────
// Calls the get_campaign_holiday_capacities RPC (SECURITY DEFINER).
// Returns a map of holiday_date ISO string → { approved_count, cap }.
// Agents can't count other agents' approved requests via RLS, so this must be an RPC.

export function useCampaignHolidayCapacities(campaignId: string | null | undefined) {
  return useQuery({
    queryKey: [CAPACITIES_KEY, campaignId],
    queryFn: async () => {
      if (!campaignId) return {} as Record<string, HolidayCapacity>;
      const { data, error } = await supabase.rpc("get_campaign_holiday_capacities", {
        p_campaign_id: campaignId,
      });
      if (error) throw error;
      const map: Record<string, HolidayCapacity> = {};
      for (const row of data || []) {
        map[row.holiday_date as string] = {
          approved_count: row.approved_count as number,
          cap: row.cap as number,
        };
      }
      return map;
    },
    enabled: !!campaignId,
  });
}

// ── useRequestHolidayOff ──────────────────────────────────────────────────────
// Calls the request_holiday_off RPC. Returns the resulting status ('approved' or
// 'pending_tl') so the caller can show the correct toast.
// Invalidates both requests and capacities on success.

export function useRequestHolidayOff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      campaignId,
      holidayDate,
      holidayName,
    }: {
      campaignId: string;
      holidayDate: string;
      holidayName: string;
      // carried through to onSuccess for cache invalidation
      employeeId: string;
    }) => {
      const { data, error } = await supabase.rpc("request_holiday_off", {
        p_campaign_id: campaignId,
        p_holiday_date: holidayDate,
        p_holiday_name: holidayName,
      });
      if (error) throw error;
      return data as "approved" | "pending_tl";
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [REQUESTS_KEY, vars.employeeId] });
      qc.invalidateQueries({ queryKey: [CAPACITIES_KEY, vars.campaignId] });
    },
  });
}

// ── useCancelHolidayRequest ───────────────────────────────────────────────────
// Updates holiday_requests.status = 'cancelled' for the given row id.
// RLS allows agents to UPDATE their own rows.

export function useCancelHolidayRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
    }: {
      id: string;
      // carried through to onSuccess for cache invalidation
      employeeId: string;
      campaignId: string;
    }) => {
      const { error } = await supabase
        .from("holiday_requests")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [REQUESTS_KEY, vars.employeeId] });
      qc.invalidateQueries({ queryKey: [CAPACITIES_KEY, vars.campaignId] });
    },
  });
}

// ── TL hooks ──────────────────────────────────────────────────────────────────

export interface CompanyHoliday {
  id: string;
  date: string;
  name: string;
  is_statutory: boolean;
}

export interface TeamHolidayRequest {
  id: string;
  employee_id: string;
  status: "approved" | "pending_tl";
  holiday_date: string;
  holiday_name: string;
  displayName: string;
}

// useNextUpcomingHoliday — single next upcoming company_holiday (date > today)
export function useNextUpcomingHoliday() {
  return useQuery({
    queryKey: ["nextUpcomingHoliday"],
    queryFn: async () => {
      const today = todayLocal();
      const { data, error } = await supabase
        .from("company_holidays")
        .select("id, date, name, is_statutory")
        .gt("date", today)
        .order("date", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as CompanyHoliday | null;
    },
  });
}

// useTeamHolidayRequests — all approved/pending_tl requests for a campaign+holiday
// employees_no_pay has no FK so we can't use PostgREST embed — fetch employee
// names separately and merge in memory, mirroring the pattern in useTeamLead.ts.
export function useTeamHolidayRequests(
  campaignId: string | null | undefined,
  holidayDate: string | null | undefined
) {
  return useQuery({
    queryKey: ["teamHolidayRequests", campaignId, holidayDate],
    queryFn: async (): Promise<TeamHolidayRequest[]> => {
      if (!campaignId || !holidayDate) return [];

      const { data: requests, error } = await supabase
        .from("holiday_requests")
        .select("id, employee_id, status, holiday_date, holiday_name")
        .eq("campaign_id", campaignId)
        .eq("holiday_date", holidayDate)
        .in("status", ["approved", "pending_tl"]);
      if (error) throw error;
      if (!requests || requests.length === 0) return [];

      const employeeIds = requests.map((r) => r.employee_id);
      const { data: empRows, error: empErr } = await supabase
        .from("employees_no_pay")
        .select("id, full_name, work_name")
        .in("id", employeeIds);
      if (empErr) throw empErr;

      const nameMap = Object.fromEntries(
        (empRows || []).map((e) => [
          e.id,
          getDisplayName({ fullName: e.full_name, workName: e.work_name ?? null }),
        ])
      );

      return requests.map((r) => ({
        id: r.id,
        employee_id: r.employee_id,
        status: r.status as "approved" | "pending_tl",
        holiday_date: r.holiday_date,
        holiday_name: r.holiday_name,
        displayName: nameMap[r.employee_id] ?? r.employee_id,
      }));
    },
    enabled: !!campaignId && !!holidayDate,
  });
}

// useTLApproveHolidayRequest — sets status='approved', stamps reviewed_by + reviewed_at
export function useTLApproveHolidayRequest() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      id,
    }: {
      id: string;
      campaignId: string;
      holidayDate: string;
    }) => {
      const { error } = await supabase
        .from("holiday_requests")
        .update({
          status: "approved",
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: ["teamHolidayRequests", vars.campaignId, vars.holidayDate],
      });
    },
  });
}

// useTLDismissHolidayRequest — sets status='denied', stamps reviewed_by + reviewed_at
export function useTLDismissHolidayRequest() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      id,
    }: {
      id: string;
      campaignId: string;
      holidayDate: string;
    }) => {
      const { error } = await supabase
        .from("holiday_requests")
        .update({
          status: "denied",
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: ["teamHolidayRequests", vars.campaignId, vars.holidayDate],
      });
    },
  });
}
