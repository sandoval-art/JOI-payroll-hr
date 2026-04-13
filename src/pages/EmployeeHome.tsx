import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

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
      iso: d.toISOString().split("T")[0],
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

export default function EmployeeHome() {
  const { user, employeeId } = useAuth();
  const [now, setNow] = useState(new Date());

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
        .select("id, full_name, client_id, shift_type")
        .eq("id", employeeId)
        .single();
      if (error) throw error;
      return data as { id: string; full_name: string; client_id: string; shift_type: string };
    },
    enabled: !!employeeId,
  });

  // Campaign name
  const { data: campaignName } = useQuery({
    queryKey: ["home-campaign", employee?.client_id],
    queryFn: async () => {
      if (!employee?.client_id) return null;
      const { data, error } = await supabase
        .from("clients")
        .select("name")
        .eq("id", employee.client_id)
        .maybeSingle();
      if (error) return null;
      return (data?.name as string) || null;
    },
    enabled: !!employee?.client_id,
  });

  // Today's entry
  const { data: todayEntry } = useQuery({
    queryKey: ["home-today", employeeId],
    queryFn: async () => {
      if (!employeeId) return null;
      const today = new Date().toISOString().split("T")[0];
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
    queryKey: ["home-week", employeeId, weekStart.toISOString().split("T")[0]],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from("time_clock")
        .select("*")
        .eq("employee_id", employeeId)
        .gte("date", weekStart.toISOString().split("T")[0])
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
        .gte("start_date", new Date().toISOString().split("T")[0])
        .order("start_date", { ascending: true })
        .limit(3);
      if (error) throw error;
      return (data || []) as TimeOffRequest[];
    },
    enabled: !!employeeId,
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
  const onTimeDays = weekEntries.filter((e) => !!e.clock_out && !e.is_late).length;

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
            {employee?.shift_type && <> · {employee.shift_type}</>}
          </p>
        </div>
        <Badge className={`${statusBadge.tone} text-sm px-3 py-1`} variant="outline">
          {statusBadge.label}
        </Badge>
      </div>

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
                    Late {todayEntry.late_minutes}m
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
          label="On-Time Days"
          value={String(onTimeDays)}
          suffix={daysWorked ? `of ${daysWorked}` : ""}
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
        />
      </div>

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
}: {
  label: string;
  value: string;
  suffix?: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{label}</span>
          {icon}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold">{value}</span>
          {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
