import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Campaign, DigestData, ProcessResult } from "./types.ts";
import {
  getDueCampaigns,
  hasDigestLogForToday,
  getKPIFields,
  getTodaysEODLogs,
  getTLNote,
  getActiveRecipients,
  getActiveAgents,
  writeDigestLog,
} from "./queries.ts";
import { formatDigestBody } from "./format.ts";

/**
 * Get today's date string (YYYY-MM-DD) in the campaign's timezone.
 */
function getTodayInTimezone(tz: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}

/**
 * Get current time as HH:MM:SS in the campaign's timezone.
 */
function getNowTimeInTimezone(tz: string): string {
  return new Date().toLocaleTimeString("en-GB", {
    timeZone: tz,
    hour12: false,
  });
}

/**
 * Check if the campaign's cutoff has passed today in its timezone.
 */
function isCutoffPassed(campaign: Campaign): boolean {
  const nowTime = getNowTimeInTimezone(campaign.eod_digest_timezone);
  return nowTime >= campaign.eod_digest_cutoff_time;
}

/**
 * Gather all data needed to render a digest for a campaign.
 */
export async function gatherDigestData(
  supabase: SupabaseClient,
  campaign: Campaign,
  digestDate: string,
): Promise<DigestData> {
  const [kpiFields, eodLogs, tlNote, recipients, activeAgents] =
    await Promise.all([
      getKPIFields(supabase, campaign.id),
      getTodaysEODLogs(supabase, campaign.id, digestDate),
      getTLNote(supabase, campaign.id, digestDate),
      getActiveRecipients(supabase, campaign.id),
      getActiveAgents(supabase, campaign.id),
    ]);

  return {
    campaign,
    digestDate,
    eodLogs,
    tlNote,
    kpiFields,
    recipients,
    activeAgents,
  };
}

/**
 * Process a single campaign: check if due, gather data, format, write log.
 */
async function processCampaign(
  supabase: SupabaseClient,
  campaign: Campaign,
): Promise<ProcessResult> {
  const digestDate = getTodayInTimezone(campaign.eod_digest_timezone);

  if (!isCutoffPassed(campaign)) {
    return {
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      status: "skipped",
      reason: "cutoff not yet passed",
    };
  }

  const alreadyLogged = await hasDigestLogForToday(
    supabase,
    campaign.id,
    digestDate,
  );
  if (alreadyLogged) {
    return {
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      status: "skipped",
      reason: "digest already logged for today",
    };
  }

  const digestData = await gatherDigestData(supabase, campaign, digestDate);
  const body = formatDigestBody(digestData);

  const submittedIds = new Set(digestData.eodLogs.map((l) => l.employee_id));
  const missingAgents = digestData.activeAgents
    .filter((a) => !submittedIds.has(a.id))
    .map((a) => a.full_name);

  await writeDigestLog(supabase, {
    campaign_id: campaign.id,
    digest_date: digestDate,
    digest_type: "daily",
    recipient_count: digestData.recipients.length,
    agent_submission_count: digestData.eodLogs.length,
    agent_missing_count: missingAgents.length,
    missing_agents: missingAgents,
    dry_run: true,
    preview_body: body,
  });

  return {
    campaign_id: campaign.id,
    campaign_name: campaign.name,
    status: "dry_run_written",
  };
}

/**
 * Main handler: load all configured campaigns, process each that is due.
 */
export async function handleDailyDigest(
  supabase: SupabaseClient,
): Promise<Response> {
  const campaigns = await getDueCampaigns(supabase);

  const results: ProcessResult[] = [];
  for (const campaign of campaigns) {
    try {
      const result = await processCampaign(supabase, campaign);
      results.push(result);
    } catch (err) {
      results.push({
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        status: "skipped",
        reason: `error: ${(err as Error).message}`,
      });
    }
  }

  const dryRunsWritten = results.filter(
    (r) => r.status === "dry_run_written",
  ).length;
  const skipped = results.filter((r) => r.status === "skipped");

  return new Response(
    JSON.stringify(
      {
        processed: campaigns.length,
        dry_runs_written: dryRunsWritten,
        skipped: skipped.map((s) => ({
          campaign: s.campaign_name,
          reason: s.reason,
        })),
      },
      null,
      2,
    ),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}
