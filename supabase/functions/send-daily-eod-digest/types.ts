export interface Campaign {
  id: string;
  name: string;
  eod_digest_cutoff_time: string; // HH:MM:SS
  eod_digest_timezone: string;
  eod_reply_to_email: string | null;
}

export interface EODLog {
  id: string;
  employee_id: string;
  date: string;
  metrics: Record<string, number | boolean>;
  notes: string | null;
  employee_name: string;
  employee_title: string;
}

export interface KPIField {
  field_name: string;
  field_label: string;
  field_type: string;
  display_order: number;
}

export interface TLNote {
  note: string | null;
  written_by_name: string | null;
}

export interface Recipient {
  email: string;
  role_label: string;
}

export interface ActiveAgent {
  id: string;
  full_name: string;
  email: string | null;
}

export interface DigestData {
  campaign: Campaign;
  digestDate: string;
  eodLogs: EODLog[];
  tlNote: TLNote | null;
  recipients: Recipient[];
  activeAgents: ActiveAgent[];
  kpiFields: KPIField[];
}

export interface ProcessResult {
  campaign_id: string;
  campaign_name: string;
  status: "dry_run_written" | "skipped";
  reason?: string;
}
