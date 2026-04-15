// DEPRECATED — 2026-04-14
// The EOD Form Builder was replaced by the Campaigns page, which now owns
// per-campaign KPI field configuration. EOD answers are collected inline
// when the agent clocks out (see src/components/ClockOutEODDialog.tsx).
//
// Safe to delete this file. Keeping it around for one build so anything
// still importing it trips an obvious error instead of compiling silently
// against dead code.

export default function EODFormBuilderDeprecated(): never {
  throw new Error(
    "EODFormBuilder has been removed. Configure EOD fields under Campaigns → <Campaign> → EOD Metrics."
  );
}
