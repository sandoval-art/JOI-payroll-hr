import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { todayLocal } from "@/lib/localDate";
import { formatMinutesVerbose } from "@/lib/formatDuration";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ClockOutEODDialog, KPIField } from "@/components/ClockOutEODDialog";
import {
  Clock,
  Coffee,
  UtensilsCrossed,
  ClipboardCheck,
  CalendarDays,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Timer,
  FileText,
} from "lucide-react";
import { useEmployeeDocuments, type DocumentWithType } from "@/hooks/useEmployeeDocuments";

interface TimeClockEntry {
  id: string;
  clock_in: string;
  clock_out: string | null;
  date: string;
  total_hours: number | null;
  is_late: boolean;
  late_minutes: number | null;
  lunch_start: string | null;
  lunch_end: string | null;
  break1_start: string | null;
  break1_end: string | null;
  break2_start: string | null;
  break2_end: string | null;
  shift_end_expected: string | null;
  auto_clocked_out: boolean;
}

interface EodLog {
  id: string;
  date: string;
  metrics: Record<string, unknown>;
  notes: string | null;
}

interface TimeOffRequest {
  id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayLabels(weekStart: Date): { iso: string; label: string }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return {
      iso: todayLocal(d),
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
    };
  });
}

function getActiveBreak(entry: TimeClockEntry | null) {
  if (!entry) return null;
  if (entry.lunch_start && !entry.lunch_end) return "lunch";
  if (entry.break1_start && !entry.break1_end) return "break1";
  if (entry.break2_start && !entry.break2_end) return "break2";
  return null;
}

function elapsedString(fromIso: string, now: Date) {
  const ms = now.getTime() - new Date(fromIso).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** "YYYY-MM-DD" for today in the given IANA timezone. */
function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Subtract `days` from a "YYYY-MM-DD" string. */
function subtractDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - days);
  return todayLocal(dt);
}

export default function EmployeeHome() {
  const { user, employeeId } = useAuth();
  const [now, setNow] = useState(new Date());
  const [backfillDate, setBackfillDate] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // Fetch employee record (for display name)
  const { data: employee } = useQuery({
    queryKey: ["home-employee", employeeId],
    queryFn: async () => {
      if (!employeeId) return null;
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, campaign_id, curp, rfc, address, phone, bank_clabe")
        .eq("id", employeeId)
        .single();
      if (error) throw error;
      return data as { id: string; full_name: string; campaign_id: string; curp: string | null; rfc: string | null; address: string | null; phone: string | null; bank_clabe: string | null };
    },
    enabled: !!employeeId,
  });

  // Campaign name + timezone
  const { data: campaign } = useQuery({
    queryKey: ["home-campaign", employee?.campaign_id],
    queryFn: async () => {
      if (!employee?.campaign_id) return null;
      const { data, error } = await supabase
        .from("campaigns")
        .select("name, eod_digest_timezone")
        .eq("id", employee.campaign_id)
        .maybeSingle();
      if (error) return null;
      return data as { name: string; eod_digest_timezone: string } | null;
    },
    enabled: !!employee?.campaign_id,
  });
  const campaignName = campaign?.name ?? null;
  const campaignTz = campaign?.eod_digest_timezone || "America/Denver";

  // Today's entry
  const { data: todayEntry } = useQuery({
    queryKey: ["home-today", employeeId],
    queryFn: async () => {
      if (!employeeId) return null;
      const today = todayLocal();
      const { data, error } = await supabase
        .from("time_clock")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("date", today)
        .maybeSingle();
      if (error) throw error;
      return (data || null) as TimeClockEntry | null;
    },
    enabled: !!employeeId,
    refetchInterval: 30000,
  });

  // Week's entries
  const weekStart = startOfWeek(now);
  const { data: weekEntries = [] } = useQuery({
    queryKey: ["home-week", employeeId, todayLocal(weekStart)],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from("time_clock")
        .select("*")
        .eq("employee_id", employeeId)
        .gte("date", todayLocal(weekStart))
        .order("date", { ascending: true });
      if (error) throw error;
      return (data || []) as TimeClockEntry[];
    },
    enabled: !!employeeId,
  });

  // Recent EOD logs (last 5)
  const { data: recentEod = [] } = useQuery({
    queryKey: ["home-eod", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from("eod_logs")
        .select("*")
        .eq("employee_id", employeeId)
        .order("date", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data || []) as EodLog[];
    },
    enabled: !!employeeId,
  });

  // Pending time-off
  const { data: pendingTimeOff = [] } = useQuery({
    queryKey: ["home-timeoff", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from("time_off_requests")
        .select("*")
        .eq("employee_id", employeeId)
        .in("status", ["pending", "approved"])
        .gte("start_date", todayLocal())
        .order("start_date", { ascending: true })
        .limit(3);
      if (error) throw error;
      return (data || []) as TimeOffRequest[];
    },
    enabled: !!employeeId,
  });

  // Missing EODs: auto-clocked-out shifts without EOD submission
  const twoDaysAgo = subtractDays(todayInTz(campaignTz), 2);
  const { data: missingEods = [] } = useQuery({
    queryKey: ["home-missing-eods", employeeId, twoDaysAgo],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from("time_clock")
        .select("id, date, auto_clocked_out, eod_completed")
        .eq("employee_id", employeeId)
        .eq("auto_clocked_out", true)
        .eq("eod_completed", false)
        .order("date", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []) as { id: string; date: string; auto_clocked_out: boolean; eod_completed: boolean }[];
    },
    enabled: !!employeeId,
  });

  // KPI fields for the backfill dialog
  const { data: kpiFields = [] } = useQuery({
    queryKey: ["home-kpi-config", employee?.campaign_id],
    queryFn: async () => {
      if (!employee?.campaign_id) return [];
      const { data, error } = await supabase
        .from("campaign_kpi_config")
        .select("*")
        .eq("campaign_id", employee.campaign_id)
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data || []) as KPIField[];
    },
    enabled: !!employee?.campaign_id,
  });

  // ---------- Derived ----------
  const firstName = (employee?.full_name || user?.email || "there").split(" ")[0];
  const isClockedIn = !!todayEntry && !todayEntry.clock_out;
  const activeBreak = getActiveBreak(todayEntry || null);

  // Build per-day chart data, even if employee has no entries (shows zeroes)
  const days = dayLabels(weekStart);
  const chartData = days.map((d) => {
    const entry = weekEntries.find((e) => e.date === d.iso);
    return {
      day: d.label,
      hours: entry?.total_hours ? Number(entry.total_hours.toFixed(2)) : 0,
    };
  });

  const weekHours = weekEntries.reduce((s, e) => s + (e.total_hours || 0), 0);
  const daysWorked = weekEntries.filter((e) => !!e.clock_out).length;
  const minutesLate = weekEntries.reduce((s, e) => s + (e.late_minutes || 0), 0);

  // Status badge text/color
  let statusBadge: { label: string; tone: string } = {
    label: "Not clocked in",
    tone: "bg-muted text-muted-foreground",
  };
  if (todayEntry?.clock_out) {
    statusBadge = {
      label: "Shift complete",
      tone: "bg-emerald-100 text-emerald-800",
    };
  } else if (activeBreak === "lunch") {
    statusBadge = { label: "On lunch", tone: "bg-amber-100 text-amber-800" };
  } else if (activeBreak === "break1" || activeBreak === "break2") {
    statusBadge = { label: "On break", tone: "bg-amber-100 text-amber-800" };
  } else if (isClockedIn) {
    statusBadge = { label: "Clocked in", tone: "bg-emerald-100 text-emerald-800" };
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Hi, {firstName}</h2>
          <p className="text-sm text-muted-foreground">
            {now.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
            {campaignName && (
              <>
                {" · "}
                <span className="font-medium text-foreground">{campaignName}</span>
              </>
            )}
          </p>
        </div>
        <Badge className={`${statusBadge.tone} text-sm px-3 py-1`} variant="outline">
          {statusBadge.label}
        </Badge>
      </div>

      {/* Missing EOD banner */}
      {missingEods.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <AlertCircle className="h-5 w-5" />
              Missing EOD Submissions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {missingEods.map((row) => {
              const isActionable = row.date >= twoDaysAgo;
              const dateLabel = new Date(`${row.date}T00:00:00`).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
              return (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-white px-4 py-2"
                >
                  <span className="text-sm font-medium">{dateLabel}</span>
                  {isActionable ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setBackfillDate(row.date)}
                    >
                      Submit EOD for {dateLabel}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Contact your TL to submit EODs older than 2 days.
                    </span>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Backfill EOD dialog */}
      {backfillDate && employee?.campaign_id && (
        <ClockOutEODDialog
          open={!!backfillDate}
          onOpenChange={(o) => { if (!o) setBackfillDate(null); }}
          employeeId={employeeId!}
          campaignId={employee.campaign_id}
          campaignName={campaignName ?? undefined}
          kpiFields={kpiFields}
          backfillDate={backfillDate}
          onSubmitted={() => {
            const dateLabel = new Date(`${backfillDate}T00:00:00`).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
            setBackfillDate(null);
            toast({ title: `EOD submitted for ${dateLabel}` });
            queryClient.invalidateQueries({ queryKey: ["home-missing-eods"] });
            queryClient.invalidateQueries({ queryKey: ["home-eod"] });
          }}
        />
      )}

      {/* Today panel + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!todayEntry && (
              <div className="text-center py-8">
                <Timer className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-4">
                  You haven't clocked in yet today.
                </p>
                <Button asChild size="lg">
                  <Link to="/reloj">Clock In</Link>
                </Button>
              </div>
            )}

            {todayEntry && !todayEntry.clock_out && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Clock In
                  </div>
                  <div className="text-2xl font-bold">
                    {new Date(todayEntry.clock_in).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Elapsed
                  </div>
                  <div className="text-2xl font-bold text-primary">
                    {elapsedString(todayEntry.clock_in, now)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Status
                  </div>
                  <div className="text-2xl font-bold flex items-center gap-1">
                    {activeBreak === "lunch" ? (
                      <>
                        <UtensilsCrossed className="h-5 w-5 text-amber-700" />
                        Lunch
                      </>
                    ) : activeBreak ? (
                      <>
                        <Coffee className="h-5 w-5 text-amber-700" />
                        Break
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        Working
                      </>
                    )}
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <Button asChild className="w-full">
                    <Link to="/reloj">Open Timeclock</Link>
                  </Button>
                </div>
              </div>
            )}

            {todayEntry?.clock_out && (
              <div className="text-center py-6">
                <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-600 mb-2" />
                <p className="font-semibold">Shift complete — nice work.</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(todayEntry.clock_in).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  →{" "}
                  {new Date(todayEntry.clock_out).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · {todayEntry.total_hours?.toFixed(2)} hrs
                  {todayEntry.auto_clocked_out && " · auto-closed"}
                </p>
                {todayEntry.is_late && (
                  <Badge variant="destructive" className="mt-2">
                    Late {formatMinutesVerbose(todayEntry.late_minutes)}
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" className="w-full justify-start h-11">
              <Link to="/reloj">
                <Timer className="mr-2 h-4 w-4" /> Timeclock
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start h-11">
              <Link to="/eod">
                <ClipboardCheck className="mr-2 h-4 w-4" /> Submit EOD
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start h-11">
              <Link to="/solicitudes">
                <CalendarDays className="mr-2 h-4 w-4" /> Request Time Off
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Hours This Week"
          value={weekHours.toFixed(1)}
          suffix="hrs"
          icon={<Clock className="h-5 w-5 text-primary" />}
        />
        <StatCard
          label="Days Worked"
          value={String(daysWorked)}
          suffix="/ 7"
          icon={<TrendingUp className="h-5 w-5 text-primary" />}
        />
        <StatCard
          label="Minutes Late This Week"
          value={String(minutesLate)}
          suffix="min"
          icon={
            <AlertCircle
              className={`h-5 w-5 ${minutesLate > 0 ? "text-red-600" : "text-emerald-600"}`}
            />
          }
          accent={minutesLate > 0 ? "text-red-600" : undefined}
        />
      </div>

      {/* A1: Personal & Tax Info (read-only for agent) */}
      {employee && (employee.curp || employee.rfc || employee.address || employee.phone || employee.bank_clabe) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">My Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {employee.curp && (
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">CURP</span>
                  <span className="text-sm font-medium">{employee.curp}</span>
                </div>
              )}
              {employee.rfc && (
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">RFC</span>
                  <span className="text-sm font-medium">{employee.rfc}</span>
                </div>
              )}
              {employee.phone && (
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Phone</span>
                  <span className="text-sm font-medium">{employee.phone}</span>
                </div>
              )}
              {employee.address && (
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Address</span>
                  <span className="text-sm font-medium">{employee.address}</span>
                </div>
              )}
              {employee.bank_clabe && (
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Bank CLABE</span>
                  <span className="text-sm font-medium">{employee.bank_clabe}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* A2b: My Documents — agent read-only */}
      <MyDocumentsCard employeeId={employeeId} />

      {/* Weekly chart */}
      <Card>
        <CardHeader>
          <CardTitle>Hours This Week</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="day"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                  formatter={(value: number) => [`${value} hrs`, "Worked"]}
                />
                <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent EOD + upcoming PTO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Recent EOD Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentEod.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No EOD reports yet. They'll show here after you submit one.
              </p>
            ) : (
              <ul className="divide-y">
                {recentEod.map((log) => (
                  <li key={log.id} className="py-2 flex justify-between text-sm">
                    <span>
                      {new Date(log.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span className="text-muted-foreground truncate max-w-[60%]">
                      {log.notes || "Submitted"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Upcoming Time Off
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingTimeOff.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No upcoming time-off requests.
              </p>
            ) : (
              <ul className="divide-y">
                {pendingTimeOff.map((req) => (
                  <li
                    key={req.id}
                    className="py-2 flex justify-between items-center text-sm"
                  >
                    <span>
                      {new Date(req.start_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                      {req.start_date !== req.end_date && (
                        <>
                          {" – "}
                          {new Date(req.end_date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </>
                      )}{" "}
                      <span className="text-muted-foreground capitalize">
                        ({req.reason})
                      </span>
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        req.status === "approved"
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-amber-50 text-amber-800"
                      }
                    >
                      {req.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {!employeeId && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <p className="text-yellow-800">
              Your account isn't linked to an employee record yet. Contact HR.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
  icon,
  accent,
}: {
  label: string;
  value: string;
  suffix?: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{label}</span>
          {icon}
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-bold ${accent || ""}`}>{value}</span>
          {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── A2b: My Documents (agent read-only) ─────────────────────────────

function docStatusBadge(doc: DocumentWithType["document"]) {
  if (!doc) return <Badge variant="outline" className="bg-muted text-muted-foreground">Not submitted</Badge>;
  if (doc.status === "pending_review") return <Badge variant="outline" className="bg-amber-50 text-amber-800">Pending review</Badge>;
  if (doc.status === "approved") return <Badge variant="outline" className="bg-emerald-50 text-emerald-800">Approved</Badge>;
  if (doc.status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  return null;
}

function MyDocumentsCard({ employeeId }: { employeeId: string | null }) {
  const { data: rows = [], isLoading } = useEmployeeDocuments(employeeId ?? undefined);

  if (isLoading || rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5" />
          My Documents
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {rows.map(({ type, document: doc }) => (
            <li key={type.id} className="py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{type.name}</p>
                {!doc && (
                  <p className="text-xs text-muted-foreground">Not submitted yet</p>
                )}
                {doc?.status === "approved" && doc.reviewed_at && (
                  <p className="text-xs text-muted-foreground">
                    Approved {new Date(doc.reviewed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                )}
                {doc?.status === "pending_review" && (
                  <p className="text-xs text-muted-foreground">Waiting for HR review</p>
                )}
                {doc?.status === "rejected" && (
                  <div>
                    {doc.rejection_reason && (
                      <p className="text-xs text-destructive">Reason: {doc.rejection_reason}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">Talk to HR to resolve</p>
                  </div>
                )}
              </div>
              {docStatusBadge(doc)}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
