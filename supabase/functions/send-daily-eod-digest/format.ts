import type { DigestData } from "./types.ts";

export function formatDigestBody(data: DigestData): string {
  const { campaign, digestDate, eodLogs, tlNote, activeAgents, kpiFields } =
    data;

  const lines: string[] = [];

  lines.push(`EOD Digest: ${campaign.name}`);
  lines.push(`Date: ${digestDate}`);
  lines.push("=".repeat(60));
  lines.push("");

  // TL Note
  lines.push("--- Team Lead Note ---");
  if (tlNote?.note) {
    lines.push(tlNote.note);
    if (tlNote.written_by_name) {
      lines.push(`  — ${tlNote.written_by_name}`);
    }
  } else {
    lines.push("No TL note for today.");
  }
  lines.push("");

  // Per-agent EOD blocks
  lines.push("--- Agent EOD Reports ---");
  lines.push("");

  if (eodLogs.length === 0) {
    lines.push("No EOD submissions for today.");
    lines.push("");
  } else {
    for (const log of eodLogs) {
      lines.push(`${log.employee_name} (${log.employee_title})`);
      lines.push("-".repeat(40));

      // KPI values in config order
      for (const field of kpiFields) {
        const value = log.metrics[field.field_name];
        if (value === undefined) continue;

        let display: string;
        if (field.field_type === "boolean") {
          display = value ? "Yes" : "No";
        } else {
          display = String(value);
        }
        lines.push(`  ${field.field_label}: ${display}`);
      }

      // Any metrics not in kpi config (safety net)
      const configuredFields = new Set(kpiFields.map((f) => f.field_name));
      for (const [key, value] of Object.entries(log.metrics)) {
        if (configuredFields.has(key)) continue;
        lines.push(`  ${key}: ${value}`);
      }

      if (log.notes) {
        lines.push(`  Notes: ${log.notes}`);
      }
      lines.push("");
    }
  }

  // Missing EODs
  const submittedIds = new Set(eodLogs.map((l) => l.employee_id));
  const missingAgents = activeAgents.filter((a) => !submittedIds.has(a.id));

  lines.push("--- Missing EODs ---");
  if (missingAgents.length === 0) {
    lines.push("All agents submitted.");
  } else {
    lines.push(
      `${missingAgents.length} of ${activeAgents.length} agents have not submitted:`,
    );
    for (const agent of missingAgents) {
      lines.push(`  - ${agent.full_name}`);
    }
  }
  lines.push("");

  // Footer
  lines.push("=".repeat(60));
  lines.push(
    `${eodLogs.length} submitted | ${missingAgents.length} missing | ${activeAgents.length} total agents`,
  );

  return lines.join("\n");
}
