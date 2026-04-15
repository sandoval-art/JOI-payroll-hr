import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClipboardCheck, ChevronDown } from "lucide-react";
import { parseLocalDate } from "@/lib/localDate";

// Read-only history of this agent's EOD submissions.
// New EODs are submitted from the Timeclock (triggered by Clock Out).
// This page is for reference — "did I submit on Tuesday?" lookups.

interface EODLog {
  id: string;
  date: string;
  campaign_id: string;
  metrics: Record<string, string | number | boolean>;
  notes: string | null;
  created_at: string;
  campaigns: { name: string } | null;
}

export default function EODHistory() {
  const { employeeId } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["eod-history", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from("eod_logs")
        .select("id, date, campaign_id, metrics, notes, created_at, campaigns(name)")
        .eq("employee_id", employeeId)
        .order("date", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data || []) as unknown as EODLog[];
    },
    enabled: !!employeeId,
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
            <p className="text-muted-foreground text-sm">Loading...</p>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const fieldCount = Object.keys(log.metrics || {}).length;
                    const open = expandedId === log.id;
                    return (
                      <>
                        <TableRow
                          key={log.id}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => setExpandedId(open ? null : log.id)}
                        >
                          <TableCell>
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {parseLocalDate(log.date).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
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
                        </TableRow>
                        {open && (
                          <TableRow key={`${log.id}-detail`}>
                            <TableCell colSpan={5} className="bg-muted/30">
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
                      </>
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
