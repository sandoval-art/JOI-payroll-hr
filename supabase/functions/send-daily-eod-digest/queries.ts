import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type {
  Campaign,
  EODLog,
  KPIField,
  TLNote,
  Recipient,
  ActiveAgent,
} from "./types.ts";

export async function getDueCampaigns(
  supabase: SupabaseClient,
): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from("campaigns")
    .select(
      "id, name, eod_digest_cutoff_time, eod_digest_timezone, eod_reply_to_email",
    )
    .not("eod_digest_cutoff_time", "is", null);

  if (error) throw new Error(`Failed to load campaigns: ${error.message}`);
  return data ?? [];
}

export async function hasDigestLogForToday(
  supabase: SupabaseClient,
  campaignId: string,
  digestDate: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("eod_digest_log")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("digest_date", digestDate)
    .eq("digest_type", "daily")
    .limit(1);

  if (error) throw new Error(`Failed to check digest log: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

export async function getKPIFields(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<KPIField[]> {
  const { data, error } = await supabase
    .from("campaign_kpi_config")
    .select("field_name, field_label, field_type, display_order")
    .eq("campaign_id", campaignId)
    .eq("is_active", true)
    .order("display_order");

  if (error) throw new Error(`Failed to load KPI fields: ${error.message}`);
  return data ?? [];
}

export async function getTodaysEODLogs(
  supabase: SupabaseClient,
  campaignId: string,
  digestDate: string,
): Promise<EODLog[]> {
  const { data, error } = await supabase
    .from("eod_logs")
    .select(
      `
      id,
      employee_id,
      date,
      metrics,
      notes,
      employees!inner ( full_name, title )
    `,
    )
    .eq("campaign_id", campaignId)
    .eq("date", digestDate);

  if (error) throw new Error(`Failed to load EOD logs: ${error.message}`);

  return (data ?? []).map((row: Record<string, unknown>) => {
    const emp = row.employees as Record<string, string>;
    return {
      id: row.id as string,
      employee_id: row.employee_id as string,
      date: row.date as string,
      metrics: row.metrics as Record<string, number | boolean>,
      notes: row.notes as string | null,
      employee_name: emp.full_name,
      employee_title: emp.title,
    };
  });
}

export async function getTLNote(
  supabase: SupabaseClient,
  campaignId: string,
  digestDate: string,
): Promise<TLNote | null> {
  const { data, error } = await supabase
    .from("campaign_eod_tl_notes")
    .select(
      `
      note,
      employees ( full_name )
    `,
    )
    .eq("campaign_id", campaignId)
    .eq("date", digestDate)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load TL note: ${error.message}`);
  if (!data) return null;

  const emp = data.employees as Record<string, string> | null;
  return {
    note: data.note,
    written_by_name: emp?.full_name ?? null,
  };
}

export async function getActiveRecipients(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<Recipient[]> {
  const { data, error } = await supabase
    .from("campaign_eod_recipients")
    .select("email, role_label")
    .eq("campaign_id", campaignId)
    .eq("active", true);

  if (error) throw new Error(`Failed to load recipients: ${error.message}`);
  return data ?? [];
}

export async function getActiveAgents(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<ActiveAgent[]> {
  const { data, error } = await supabase
    .from("employees")
    .select("id, full_name, email")
    .eq("campaign_id", campaignId)
    .eq("is_active", true)
    .in("title", ["agent", "team_lead"]);

  if (error) throw new Error(`Failed to load active agents: ${error.message}`);
  return data ?? [];
}

export async function writeDigestLog(
  supabase: SupabaseClient,
  row: {
    campaign_id: string;
    digest_date: string;
    digest_type: string;
    recipient_count: number;
    agent_submission_count: number;
    agent_missing_count: number;
    missing_agents: string[];
    dry_run: boolean;
    preview_body: string;
  },
): Promise<void> {
  const { error } = await supabase.from("eod_digest_log").insert({
    ...row,
    missing_agents: JSON.stringify(row.missing_agents),
  });

  if (error) throw new Error(`Failed to write digest log: ${error.message}`);
}
