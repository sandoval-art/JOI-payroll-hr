import { Fragment, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDateMXLong } from "@/lib/localDate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogoLoadingIndicator } from "@/components/ui/LogoLoadingIndicator";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClipboardCheck, ChevronDown, Pencil } from "lucide-react";
import { parseLocalDate } from "@/lib/localDate";
import { useToast } from "@/hooks/use-toast";
import { ClockOutEODDialog, KPIField, FormValues } from "@/components/ClockOutEODDialog";

// Read-only history of this agent's EOD submissions — with inline edit.

interface EODLog {
  id: string;
  date: string;
  campaign_id: string;
  metrics: Record<string, string | number | boolean>;
  notes: string | null;
  created_at: string;
  edit_count: number;
  campaigns: { name: string; eod_digest_cutoff_time: string | null; eod_digest_timezone: string } | null;
}

/** True if the campaign's cutoff time hasn't passed yet today in that timezone. */
function isCutoffStillOpen(cutoffTime: string | null, tz: string, eodDate: string): boolean {
  if (!cutoffTime) return false;
  // EOD date must be today in campaign tz
  const todayInTz = new Intl.DateTimeFormat("sv-SE", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  if (eodDate !== todayInTz) return false;
  // Current time in tz must be before cutoff
  const nowInTz = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(new Date());
  return nowInTz < cutoffTime;
}

export default function EODHistory() {
  const { employeeId } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [amendLog, setAmendLog] = useState<EODLog | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["eod-history", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from("eod_logs")
        .select("id, date, campaign_id, metrics, notes, created_at, edit_count, campaigns(name, eod_digest_cutoff_time, eod_digest_timezone)")
        .eq("employee_id", employeeId)
        .order("date", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data || []) as unknown as EODLog[];
    },
    enabled: !!employeeId,
  });

  // Fetch employee for campaign_id
  const { data: employee } = useQuery({
    queryKey: ["eod-employee", employeeId],
    queryFn: async () => {
      if (!employeeId) return null;
      const { data, error } = await supabase
        .from("employees")
        .select("id, campaign_id")
        .eq("id", employeeId)
        .single();
      if (error) throw error;
      return data as { id: string; campaign_id: string };
    },
    enabled: !!employeeId,
  });

  // KPI fields for amend dialog
  const { data: kpiFields = [] } = useQuery({
    queryKey: ["eod-kpi-config", employee?.campaign_id],
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

  if (!employeeId) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">My EOD History</h1>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Your account is not linked to an employee.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My EOD History</h1>
        <p className="text-muted-foreground mt-2">
          Your past end-of-day reports. New reports are submitted when you clock out.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Recent Submissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LogoLoadingIndicator size="sm" />
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No EOD reports yet. Your next one will be submitted when you clock out.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Date</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Submitted At</TableHead>
                    <TableHead className="text-right">Fields</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const fieldCount = Object.keys(log.metrics || {}).length;
                    const open = expandedId === log.id;
                    const tz = log.campaigns?.eod_digest_timezone || "America/Denver";
                    const canEdit = isCutoffStillOpen(
                      log.campaigns?.eod_digest_cutoff_time ?? null,
                      tz,
                      log.date,
                    );
                    return (
                      <Fragment key={log.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => setExpandedId(open ? null : log.id)}
                        >
                          <TableCell>
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatDateMXLong(log.date)}
                            {log.edit_count > 0 && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                edited {log.edit_count}x
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.campaigns?.name || "—"}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(log.created_at).toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </TableCell>
                          <TableCell className="text-right text-sm">{fieldCount}</TableCell>
                          <TableCell>
                            {canEdit && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => { e.stopPropagation(); setAmendLog(log); }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        {open && (
                          <TableRow key={`${log.id}-detail`}>
                            <TableCell colSpan={6} className="bg-muted/30">
                              <div className="py-2 space-y-2">
                                {Object.entries(log.metrics || {}).map(([k, v]) => (
                                  <div key={k} className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{k}</span>
                                    <span className="font-medium">
                                      {typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}
                                    </span>
                                  </div>
                                ))}
                                {log.notes && (
                                  <div className="pt-2 mt-2 border-t text-sm">
                                    <div className="text-muted-foreground mb-1">Notes</div>
                                    <div className="italic">{log.notes}</div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Amend dialog */}
      {amendLog && employee?.campaign_id && (
        <ClockOutEODDialog
          open={!!amendLog}
          onOpenChange={(o) => { if (!o) setAmendLog(null); }}
          employeeId={employeeId}
          campaignId={employee.campaign_id}
          campaignName={amendLog.campaigns?.name}
          kpiFields={kpiFields}
          amendLogId={amendLog.id}
          initialValues={amendLog.metrics as FormValues}
          initialNotes={amendLog.notes ?? undefined}
          onSubmitted={() => {
            setAmendLog(null);
            toast({ title: "EOD updated" });
            queryClient.invalidateQueries({ queryKey: ["eod-history"] });
          }}
        />
      )}
    </div>
  );
}
