import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VacationRequest {
  id: string;
  employee_id: string;
  campaign_id: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  status: "pending_tl" | "pending_hr" | "approved" | "denied" | "cancelled";
  notes: string | null;
  tl_reviewed_by: string | null;
  tl_reviewed_at: string | null;
  hr_reviewed_by: string | null;
  hr_reviewed_at: string | null;
  denial_reason: string | null;
  created_at: string;
}

export interface VacationBalance {
  entitlement_days: number;
  used_days: number;
  available_days: number;
  years_of_service: number;
  next_entitlement_date: string | null;
}

export function useVacationBalance(employeeId: string | null | undefined) {
  return useQuery({
    queryKey: ["vacationBalance", employeeId],
    enabled: !!employeeId,
    queryFn: async (): Promise<VacationBalance | null> => {
      const { data, error } = await supabase.rpc("get_vacation_balance", {
        p_employee_id: employeeId!,
      });
      if (error) throw error;
      if (!data || (data as VacationBalance[]).length === 0) return null;
      return (data as VacationBalance[])[0];
    },
  });
}

export function useMyVacationRequests(employeeId: string | null | undefined) {
  return useQuery({
    queryKey: ["vacationRequests", employeeId],
    enabled: !!employeeId,
    queryFn: async (): Promise<VacationRequest[]> => {
      const { data, error } = await supabase
        .from("vacation_requests")
        .select("*")
        .eq("employee_id", employeeId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VacationRequest[];
    },
  });
}

interface RequestVacationOffVars {
  employeeId: string;
  campaignId: string;
  startDate: string;
  endDate: string;
  notes?: string;
}

export function useRequestVacationOff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: RequestVacationOffVars): Promise<VacationRequest> => {
      const { data, error } = await supabase.rpc("request_vacation_off", {
        p_employee_id: vars.employeeId,
        p_campaign_id: vars.campaignId,
        p_start_date: vars.startDate,
        p_end_date: vars.endDate,
        p_notes: vars.notes ?? null,
      });
      if (error) throw error;
      return data as VacationRequest;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["vacationRequests", vars.employeeId] });
      queryClient.invalidateQueries({ queryKey: ["vacationBalance", vars.employeeId] });
    },
  });
}

interface CancelVacationRequestVars {
  requestId: string;
  employeeId: string;
}

export function useCancelVacationRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: CancelVacationRequestVars) => {
      const { error } = await supabase
        .from("vacation_requests")
        .update({ status: "cancelled" })
        .eq("id", vars.requestId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["vacationRequests", vars.employeeId] });
      queryClient.invalidateQueries({ queryKey: ["vacationBalance", vars.employeeId] });
    },
  });
}
