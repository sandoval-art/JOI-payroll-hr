/**
 * Local-date helpers for the timeclock / EOD flows.
 *
 * `new Date().toISOString().split("T")[0]` returns a UTC date string.
 * For an agent in Mexico (UTC-6) clocking in at 6 PM on the 13th, UTC is
 * already the 14th — so the row got stamped with the wrong calendar day.
 *
 * All `time_clock.date` and `eod_logs.date` writes must use `todayLocal()`.
 * All displays of those dates should go through `parseLocalDate()` so the
 * string doesn't get re-parsed as UTC midnight and render as the prior day.
 */

export function todayLocal(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD string as local midnight (not UTC midnight). */
export function parseLocalDate(dateStr: string): Date {
  // Appending the time component forces local parsing in all JS engines.
  return new Date(`${dateStr}T00:00:00`);
}
