import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { todayLocal } from "@/lib/localDate";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ClientHolidaySummary {
  holiday_date: string;
  holiday_name: string;
  requires_coverage: boolean;
  approved_off: number;
  total_headcount: number;
}

export interface ClientCampaign {
  id: string;
  name: string;
  client_id: string;
}

export interface ClientEmployee {
  id: string;
  display_name: string | null;
  campaign_id: string | null;
  title: string | null;
  is_active: boolean | null;
}

export interface ClientEodLog {
  id: string;
  employee_id: string | null;
  campaign_id: string | null;
  date: string | null;
  metrics: Record<string, unknown> | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the Monday (YYYY-MM-DD) and Sunday of the ISO week containing `today`. */
function currentWeekRange(): { monday: string; sunday: string } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // offset to Monday
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return { monday: fmt(mon), sunday: fmt(sun) };
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Fetches campaigns visible to the authenticated client user.
 * RLS on `campaigns` limits results to `client_id = my_client_id()`.
 */
export function useClientCampaigns() {
  return useQuery({
    queryKey: ["client-campaigns"],
    queryFn: async (): Promise<ClientCampaign[]> => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, client_id")
        .order("name");
      if (error) throw error;
      return (data ?? []) as ClientCampaign[];
    },
  });
}

/**
 * Fetches all employees visible to the client from `employees_client_view`.
 * The view's WHERE clause scopes results to the client's own campaigns.
 */
export function useClientEmployees() {
  return useQuery({
    queryKey: ["client-employees"],
    queryFn: async (): Promise<ClientEmployee[]> => {
      const { data, error } = await supabase
        .from("employees_client_view")
        .select("id, display_name, campaign_id, title, is_active")
        .order("display_name");
      if (error) throw error;
      return (data ?? []) as ClientEmployee[];
    },
  });
}

/**
 * Fetches the next upcoming holiday summary for a campaign via the
 * get_client_holiday_summary RPC. Returns null if no upcoming holiday exists
 * or the campaign isn't visible to the current client user.
 */
export function useClientHolidaySummary(campaignId: string | undefined) {
  return useQuery({
    queryKey: ["clientHolidaySummary", campaignId],
    enabled: !!campaignId,
    queryFn: async (): Promise<ClientHolidaySummary | null> => {
      if (!campaignId) return null;
      const { data, error } = await supabase
        .rpc("get_client_holiday_summary", { p_campaign_id: campaignId });
      if (error) throw error;
      const row = (data as ClientHolidaySummary[] | null)?.[0] ?? null;
      // Only show holidays that haven't passed yet
      if (!row || row.holiday_date <= todayLocal()) return null;
      return row;
    },
  });
}

/**
 * Fetches this-week EOD logs for a specific campaign from `eod_logs_client_view`.
 * Scoped to Monday–Sunday of the current ISO week.
 */
export function useClientEodLogsThisWeek(campaignId: string | undefined) {
  const { monday, sunday } = currentWeekRange();

  return useQuery({
    queryKey: ["client-eod-week", campaignId, monday],
    enabled: !!campaignId,
    queryFn: async (): Promise<ClientEodLog[]> => {
      const { data, error } = await supabase
        .from("eod_logs_client_view")
        .select("id, employee_id, campaign_id, date, metrics")
        .eq("campaign_id", campaignId!)
        .gte("date", monday)
        .lte("date", sunday)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClientEodLog[];
    },
  });
}
