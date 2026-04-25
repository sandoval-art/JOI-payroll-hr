import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Users, BarChart3 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LogoLoadingIndicator } from "@/components/ui/LogoLoadingIndicator";
import { formatDateMX } from "@/lib/localDate";
import {
  useClientCampaigns,
  useClientEmployees,
  useClientEodLogsThisWeek,
  type ClientEodLog,
} from "@/hooks/useClientPortal";

export default function ClientCampaignDetail() {
  const { id: campaignId } = useParams<{ id: string }>();

  const { data: campaigns = [], isLoading: campaignsLoading } = useClientCampaigns();
  const { data: employees = [], isLoading: employeesLoading } = useClientEmployees();
  const { data: eodLogs = [], isLoading: eodLoading } = useClientEodLogsThisWeek(campaignId);

  const isLoading = campaignsLoading || employeesLoading || eodLoading;

  const campaign = campaigns.find((c) => c.id === campaignId);
  const campaignEmployees = employees.filter((e) => e.campaign_id === campaignId);

  // Derive KPI column headers from the union of all metrics keys across this week's logs.
  // Order is stable (insertion order of first log that introduces each key).
  const kpiKeys = (() => {
    const seen = new Set<string>();
    const keys: string[] = [];
    for (const log of eodLogs) {
      if (!log.metrics) continue;
      for (const key of Object.keys(log.metrics)) {
        if (!seen.has(key)) {
          seen.add(key);
          keys.push(key);
        }
      }
    }
    return keys;
  })();

  // Build a map: employeeId → date → log (for the KPI table)
  const logsByEmployee = new Map<string, Map<string, ClientEodLog>>();
  for (const log of eodLogs) {
    if (!log.employee_id || !log.date) continue;
    if (!logsByEmployee.has(log.employee_id)) {
      logsByEmployee.set(log.employee_id, new Map());
    }
    logsByEmployee.get(log.employee_id)!.set(log.date, log);
  }

  // Get sorted unique dates present in this week's logs
  const logDates = [...new Set(eodLogs.map((l) => l.date).filter(Boolean) as string[])].sort(
    (a, b) => a.localeCompare(b),
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LogoLoadingIndicator size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/client"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All campaigns
        </Link>
        <h2 className="text-2xl font-bold tracking-tight">
          {campaign?.name ?? "Campaign"}
        </h2>
      </div>

      {/* Section 1 — Agent roster */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Agent Roster
          </CardTitle>
        </CardHeader>
        <CardContent>
          {campaignEmployees.length === 0 ? (
            <p className="text-sm text-muted-foreground">No agents on this campaign.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaignEmployees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">
                      {emp.display_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground capitalize">
                      {emp.title?.replace(/_/g, " ") ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={emp.is_active ? "outline" : "secondary"}
                        className="text-xs"
                      >
                        {emp.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Section 2 — This-week KPIs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            This Week's Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {eodLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No EOD submissions logged this week yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background">Agent</TableHead>
                    {logDates.map((date) => (
                      <TableHead key={date} className="text-center" colSpan={kpiKeys.length || 1}>
                        {formatDateMX(date)}
                      </TableHead>
                    ))}
                  </TableRow>
                  {kpiKeys.length > 0 && (
                    <TableRow className="text-xs text-muted-foreground">
                      <TableHead className="sticky left-0 bg-background" />
                      {logDates.flatMap((date) =>
                        kpiKeys.map((key) => (
                          <TableHead key={`${date}-${key}`} className="text-center font-normal">
                            {key}
                          </TableHead>
                        )),
                      )}
                    </TableRow>
                  )}
                </TableHeader>
                <TableBody>
                  {campaignEmployees
                    .filter((emp) => logsByEmployee.has(emp.id ?? ""))
                    .map((emp) => {
                      const empLogs = logsByEmployee.get(emp.id ?? "") ?? new Map();
                      return (
                        <TableRow key={emp.id}>
                          <TableCell className="font-medium sticky left-0 bg-background">
                            {emp.display_name ?? "—"}
                          </TableCell>
                          {logDates.flatMap((date) => {
                            const log = empLogs.get(date);
                            if (!log) {
                              return kpiKeys.map((key) => (
                                <TableCell
                                  key={`${date}-${key}`}
                                  className="text-center text-muted-foreground"
                                >
                                  —
                                </TableCell>
                              ));
                            }
                            return kpiKeys.map((key) => {
                              const val = log.metrics?.[key];
                              return (
                                <TableCell key={`${date}-${key}`} className="text-center">
                                  {val != null ? String(val) : "—"}
                                </TableCell>
                              );
                            });
                          })}
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
