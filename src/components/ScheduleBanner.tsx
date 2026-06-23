import { LogIn, LogOut, Coffee, UtensilsCrossed, CalendarDays, AlertCircle } from "lucide-react";
import { getBreakSchedule, type AltShift, type BreakSchedule } from "@/lib/breakSchedules";

interface ScheduleBannerProps {
  employeeId: string | null | undefined;
  /**
   * "full"  — bordered card with chips for each break (use between cards).
   * "compact" — slim one-line summary (use directly under the Clock In button).
   */
  variant?: "full" | "compact";
}

/**
 * Read-only banner that shows an agent their own scheduled clock-in/out and
 * breaks. Data comes from src/lib/breakSchedules.ts (sourced from the June 17
 * 2026 schedule PDF, keyed by employee_id).
 *
 * Display-only: it does NOT change clock-in or break enforcement. It just tells
 * the agent WHEN they're scheduled so they break in their assigned wave.
 */
export function ScheduleBanner({ employeeId, variant = "full" }: ScheduleBannerProps) {
  const schedule = getBreakSchedule(employeeId);

  if (variant === "compact") {
    if (!schedule) return null; // keep the area clean when nothing's on file
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 font-medium text-[#0A1133]">
          <CalendarDays className="h-3.5 w-3.5 text-[#FFA700]" />
          Your schedule
        </span>
        <CompactItem label="In" value={schedule.clockIn} />
        <CompactItem label="Break 1" value={schedule.break1} />
        <CompactItem
          label={schedule.lunchGroup ? `Lunch (${schedule.lunchGroup})` : "Lunch"}
          value={schedule.lunch}
        />
        <CompactItem label="Break 2" value={schedule.break2} />
        <CompactItem label="Out" value={schedule.clockOut} />
      </div>
    );
  }

  // No schedule on file (e.g. department not yet assigned) — soft empty state.
  if (!schedule) {
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40 p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4 shrink-0" />
        No break schedule is assigned to you yet. Check with HR.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2 bg-[#0A1133] text-white">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="h-4 w-4 text-[#FFA700]" />
          Your scheduled times
        </div>
        <div className="text-xs text-white/70">
          {schedule.campaign} · {schedule.unit}
        </div>
      </div>
      <ShiftRow s={schedule} days={schedule.days} />
      {schedule.altShift && <AltShiftRow alt={schedule.altShift} />}
      <p className="px-4 pb-3 pt-1 text-xs text-amber-800/80">
        Stay within these exact times — breaks are scheduled, not chosen. Log every
        break and lunch in both the JOI app and your CRM.
      </p>
    </div>
  );
}

function CompactItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-[#0A1133]">{value}</span>
    </span>
  );
}

function ShiftRow({ s, days }: { s: BreakSchedule; days: string }) {
  return (
    <div className="px-4 pt-3">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-900/70">
        {days}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Chip icon={<LogIn className="h-3.5 w-3.5" />} label="Clock in" value={s.clockIn} />
        <Chip icon={<Coffee className="h-3.5 w-3.5" />} label="Break 1" value={s.break1} />
        <Chip
          icon={<UtensilsCrossed className="h-3.5 w-3.5" />}
          label={s.lunchGroup ? `Lunch · Group ${s.lunchGroup}` : "Lunch"}
          value={s.lunch}
        />
        <Chip icon={<Coffee className="h-3.5 w-3.5" />} label="Break 2" value={s.break2} />
      </div>
      <div className="mt-2 text-xs text-amber-900/60">
        <LogOut className="mr-1 inline h-3 w-3" />
        Clock out {s.clockOut}
      </div>
    </div>
  );
}

function AltShiftRow({ alt }: { alt: AltShift }) {
  return (
    <div className="mt-2 px-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-900/70">
        {alt.days}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Chip icon={<LogIn className="h-3.5 w-3.5" />} label="Clock in" value={alt.clockIn} />
        <Chip icon={<Coffee className="h-3.5 w-3.5" />} label="Break 1" value={alt.break1} />
        <Chip icon={<UtensilsCrossed className="h-3.5 w-3.5" />} label="Lunch" value={alt.lunch} />
        <Chip icon={<Coffee className="h-3.5 w-3.5" />} label="Break 2" value={alt.break2} />
      </div>
      <div className="mt-2 text-xs text-amber-900/60">
        <LogOut className="mr-1 inline h-3 w-3" />
        Clock out {alt.clockOut}
      </div>
    </div>
  );
}

function Chip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-amber-200 bg-white px-2.5 py-1.5">
      <div className="flex items-center gap-1 text-[11px] font-medium text-amber-900/70">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-[#0A1133]">{value}</div>
    </div>
  );
}
