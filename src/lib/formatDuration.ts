/**
 * Format a minute count as verbose human-readable text.
 *
 * - `null`, `undefined`, or `0` → `""` (render nothing)
 * - Singular/plural: "1 hour", "2 hours", "1 minute", "2 minutes"
 * - Skips zero components: 60 → "1 hour", not "1 hour 0 minutes"
 * - Combines hours + remainder: 123 → "2 hours 3 minutes"
 */
export function formatMinutesVerbose(mins: number | null | undefined): string {
  if (mins == null || mins === 0) return "";

  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (remainder > 0) parts.push(`${remainder} ${remainder === 1 ? "minute" : "minutes"}`);

  return parts.join(" ");
}
