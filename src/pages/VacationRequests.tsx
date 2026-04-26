import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  useVacationBalance,
  useMyVacationRequests,
  useRequestVacationOff,
  useCancelVacationRequest,
} from "@/hooks/useVacationRequests";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, CalendarCheck, AlertCircle } from "lucide-react";
import { formatDateMX, todayLocal } from "@/lib/localDate";
import { toast } from "sonner";

function minStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 21);
  return todayLocal(d);
}

function daysBetween(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  return Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
}

const STATUS_LABELS: Record<string, string> = {
  pending_tl: "Pending TL",
  pending_hr: "Pending HR",
  approved: "Approved",
  denied: "Denied",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  pending_tl: "bg-yellow-100 text-yellow-800",
  pending_hr: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  denied: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
};

export default function VacationRequests() {
  const { employeeId } = useAuth();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch campaign_id for the logged-in employee
  const { data: campaignId } = useQuery({
    queryKey: ["employeeCampaign", employeeId],
    enabled: !!employeeId,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("employees")
        .select("campaign_id")
        .eq("id", employeeId!)
        .single();
      if (error) throw error;
      return (data?.campaign_id as string) ?? null;
    },
  });

  const { data: balance, isLoading: balanceLoading } = useVacationBalance(employeeId);
  const { data: requests = [], isLoading: requestsLoading } = useMyVacationRequests(employeeId);
  const requestMutation = useRequestVacationOff();
  const cancelMutation = useCancelVacationRequest();

  const min = minStartDate();
  const liveDays =
    startDate && endDate && endDate >= startDate
      ? daysBetween(startDate, endDate)
      : null;

  async function handleSubmit() {
    if (!employeeId || !campaignId || !startDate || !endDate) return;
    try {
      await requestMutation.mutateAsync({
        employeeId,
        campaignId,
        startDate,
        endDate,
        notes: notes.trim() || undefined,
      });
      toast.success("Vacation request submitted.");
      setStartDate("");
      setEndDate("");
      setNotes("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit request.";
      toast.error(msg);
    }
  }

  async function handleCancel(requestId: string) {
    if (!employeeId) return;
    try {
      await cancelMutation.mutateAsync({ requestId, employeeId });
      toast.success("Request cancelled.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to cancel request.";
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Vacation Requests</h1>
        <p className="text-muted-foreground mt-2">
          View your vacation balance and submit time-off requests.
        </p>
      </div>

      {/* Balance Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5" />
            Vacation Balance — {new Date().getFullYear()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {balanceLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          ) : balance === null ? (
            <p className="text-muted-foreground">Unable to load balance.</p>
          ) : balance.years_of_service === 0 ? (
            <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-yellow-800">First Year — No Vacation Entitlement Yet</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Employees become eligible for vacation after completing one full year of service.
                </p>
                {balance.next_entitlement_date && (
                  <p className="text-sm text-yellow-700 mt-1">
                    Your entitlement begins on{" "}
                    <span className="font-medium">{formatDateMX(balance.next_entitlement_date)}</span>.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border bg-card p-4 text-center">
                <p className="text-3xl font-bold">{balance.entitlement_days}</p>
                <p className="text-sm text-muted-foreground mt-1">Entitled</p>
              </div>
              <div className="rounded-lg border bg-card p-4 text-center">
                <p className="text-3xl font-bold text-orange-600">{balance.used_days}</p>
                <p className="text-sm text-muted-foreground mt-1">Used</p>
              </div>
              <div className="rounded-lg border bg-card p-4 text-center">
                <p className="text-3xl font-bold text-green-600">{balance.available_days}</p>
                <p className="text-sm text-muted-foreground mt-1">Available</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request Form */}
      {balance && balance.years_of_service > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>New Vacation Request</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    min={min}
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (endDate && e.target.value > endDate) setEndDate("");
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    min={startDate || min}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              {liveDays !== null && (
                <p className="text-sm text-muted-foreground">
                  Duration:{" "}
                  <span className="font-semibold text-foreground">
                    {liveDays} {liveDays === 1 ? "day" : "days"}
                  </span>
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                Requests must be submitted at least 21 days in advance (earliest start:{" "}
                <span className="font-medium">{formatDateMX(min)}</span>).
              </p>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional details..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="min-h-20"
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={
                  requestMutation.isPending ||
                  !startDate ||
                  !endDate ||
                  !campaignId
                }
                className="w-full"
              >
                Submit Request
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* My Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />
            My Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requestsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No vacation requests yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dates</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="w-4 h-4 shrink-0 text-muted-foreground" />
                          {formatDateMX(req.start_date)} – {formatDateMX(req.end_date)}
                        </div>
                      </TableCell>
                      <TableCell>{req.days_requested}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[req.status] ?? "bg-gray-100 text-gray-800"}>
                          {STATUS_LABELS[req.status] ?? req.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateMX(req.created_at)}
                      </TableCell>
                      <TableCell>
                        {(req.status === "pending_tl" || req.status === "pending_hr") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={cancelMutation.isPending}
                            onClick={() => handleCancel(req.id)}
                          >
                            Cancel
                          </Button>
                        )}
                        {req.status === "denied" && req.denial_reason && (
                          <span className="text-xs text-muted-foreground italic">
                            {req.denial_reason}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
