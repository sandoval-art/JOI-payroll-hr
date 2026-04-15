import { useAuth } from "@/hooks/useAuth";
import {
  useTeamRoster,
  useTodayTimeclockStatus,
  usePendingTimeOffForTeam,
  useTeamEODThisWeek,
  useUnderperformerAlerts,
} from "@/hooks/useTeamLead";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Clock, CalendarDays, TrendingUp, AlertTriangle, CheckCircle2, XCircle, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { todayLocal, parseLocalDate } from "@/lib/localDate";

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateRange(start: string, end: string): string {
  const s = parseLocalDate(start);
  const e = parseLocalDate(end);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (start === end) return fmt(s);
  return `${fmt(s)} – ${fmt(e)}`;
}

export default function TeamLeadHome() {
  const { employeeId } = useAuth();
  const queryClient = useQueryClient();

  // Fetch TL's own employee record for name + campaign
  const { data: tlEmployee } = useQuery({
    queryKey: ["tl-self", employeeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("full_name, campaign_id, campaigns(name)")
        .eq("id", employeeId!)
        .single();
      return data;
    },
    enabled: !!employeeId,
  });

  const roster = useTeamRoster(employeeId ?? undefined);
  const timeclock = useTodayTimeclockStatus(employeeId ?? undefined);
  const pendingTimeOff = usePendingTimeOffForTeam(employeeId ?? undefined);
  const eodWeek = useTeamEODThisWeek(employeeId ?? undefined);
  const alerts = useUnderperformerAlerts(employeeId ?? undefined);

  const firstName = tlEmployee?.full_name?.split(" ")[0] ?? "Team Lead";
  const campaignData = tlEmployee?.campaigns as { name: string } | null;
  const campaignName = campaignData?.name ?? "Your Campaign";
  const teamSize = roster.data?.length ?? 0;

  // Approve / Deny time-off mutation
  const reviewMutation = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: string; status: "approved" | "denied" }) => {
      const { error } = await supabase
        .from("time_off_requests")
        .update({ status, reviewed_by: employeeId, reviewed_at: new Date().toISOString() })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["team-timeoff-pending"] });
      toast.success(`Request ${status}`);
    },
  });

  // ---------- Status badge helper ----------
  function statusBadge(status: string) {
    switch (status) {
      case "present":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">On Time</Badge>;
      case "late":
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Late</Badge>;
      case "absent":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Absent</Badge>;
      case "completed":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Done</Badge>;
      case "day_off":
        return <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">Day Off</Badge>;
      case "expected":
        return <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">Expected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  // ---------- EOD metric columns ----------
  const eodData = eodWeek.data ?? [];
  const metricKeys: string[] = [];
  for (const row of eodData) {
    if (row.metrics && typeof row.metrics === "object") {
      for (const key of Object.keys(row.metrics as Record<string, unknown>)) {
        if (!metricKeys.includes(key) && metricKeys.length < 3) {
          metricKeys.push(key);
        }
      }
    }
    if (metricKeys.length >= 3) break;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Hi, {firstName}</h2>
        <p className="text-sm text-muted-foreground">
          {campaignName} &middot; Team of {teamSize}
        </p>
      </div>

      {/* 2-col grid for cards 1, 2, and 4 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1 — Today's Attendance */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Today's Attendance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {timeclock.isLoading && (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}
            {!timeclock.isLoading && (!timeclock.data || timeclock.data.length === 0) && (
              <p className="text-sm text-muted-foreground">No attendance data for today.</p>
            )}
            {timeclock.data?.map((entry) => (
              <div
                key={entry.employeeId}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{entry.employeeName}</span>
                  {statusBadge(entry.status)}
                </div>
                <div className="flex items-center gap-2">
                  {(entry.status === "present" || entry.status === "completed") && (
                    <span className="text-xs text-muted-foreground">
                      In: {formatTime(entry.clockIn)}
                    </span>
                  )}
                  {entry.status === "late" && (
                    <span className="text-xs text-muted-foreground">
                      {entry.clockIn ? `In: ${formatTime(entry.clockIn)}` : "Not in yet"}
                    </span>
                  )}
                  {(entry.status === "late" || entry.status === "absent") && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => console.log("TODO: nudge", entry.employeeId)}
                    >
                      Nudge
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Card 2 — Pending Time Off */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Pending Time Off</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingTimeOff.isLoading && (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}
            {!pendingTimeOff.isLoading &&
              (!pendingTimeOff.data || pendingTimeOff.data.length === 0) && (
                <p className="text-sm text-muted-foreground">No pending requests.</p>
              )}
            {pendingTimeOff.data?.map((req) => (
              <div
                key={req.id}
                className="flex flex-col gap-1 rounded-md border px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{req.employeeName}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateRange(req.startDate, req.endDate)}
                  </span>
                </div>
                {req.reason && (
                  <p className="text-xs text-muted-foreground">{req.reason}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-green-300 text-green-700 hover:bg-green-50"
                    disabled={reviewMutation.isPending}
                    onClick={() =>
                      reviewMutation.mutate({ requestId: req.id, status: "approved" })
                    }
                  >
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50"
                    disabled={reviewMutation.isPending}
                    onClick={() =>
                      reviewMutation.mutate({ requestId: req.id, status: "denied" })
                    }
                  >
                    <XCircle className="mr-1 h-3 w-3" />
                    Deny
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Card 3 — EOD Performance This Week (full width) */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">EOD Performance This Week</CardTitle>
          </CardHeader>
          <CardContent>
            {eodWeek.isLoading && (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}
            {!eodWeek.isLoading && eodData.length === 0 && (
              <p className="text-sm text-muted-foreground">No EOD data this week.</p>
            )}
            {eodData.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    {metricKeys.map((key) => (
                      <TableHead key={key} className="capitalize">
                        {key.replace(/_/g, " ")}
                      </TableHead>
                    ))}
                    <TableHead>Submissions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eodData.map((row) => {
                    const metrics = (row.metrics ?? {}) as Record<string, unknown>;
                    return (
                      <TableRow key={row.employeeId}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{row.employeeName}</span>
                            {row.isTop && (
                              <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">
                                Top
                              </Badge>
                            )}
                            {row.isBottom && (
                              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs">
                                Needs attention
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        {metricKeys.map((key) => (
                          <TableCell key={key}>
                            {metrics[key] != null ? String(metrics[key]) : "—"}
                          </TableCell>
                        ))}
                        <TableCell>{row.submissions}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Card 4 — Alerts */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.isLoading && (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}
            {!alerts.isLoading && (!alerts.data || alerts.data.length === 0) && (
              <div className="flex items-center gap-2 rounded-md bg-green-50 px-4 py-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm text-green-800">
                  Everyone's on track this week.
                </span>
              </div>
            )}
            {alerts.data && alerts.data.length > 0 && (
              <div className="space-y-2">
                {alerts.data.map((alert, idx) => (
                  <div
                    key={`${alert.employeeId}-${idx}`}
                    className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <div className="text-sm">
                      <span className="font-medium">{alert.employeeName}</span>
                      <span className="text-amber-800 ml-1">— {alert.reason}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
