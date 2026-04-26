import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
