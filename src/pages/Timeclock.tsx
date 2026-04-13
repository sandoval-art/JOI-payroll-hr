import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Clock, LogIn, LogOut, AlertCircle } from "lucide-react";

interface TimeClockEntry {
  id: string;
  employee_id: string;
  clock_in: string;
  clock_out: string | null;
  date: string;
  total_hours: number | null;
  is_late: boolean;
  late_minutes: number | null;
  created_at: string;
}

interface ShiftSettings {
  id: string;
  campaign_id: string;
  shift_name: string;
  start_time: string;
  end_time: string;
  grace_minutes: number;
  days_of_week: string[];
}

interface Employee {
  id: string;
  client_id: string;
  campaign_id: string;
}

export default function Timeclock() {
  const { employeeId, loading: authLoading } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const queryClient = useQueryClient();

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch employee data
  const { data: employee } = useQuery({
    queryKey: ["employee", employeeId],
    queryFn: async () => {
      if (!employeeId) return null;
      const { data, error } = await supabase
        .from("employees")
        .select("id, client_id, campaign_id")
        .eq("id", employeeId)
        .single();
      if (error) throw error;
      return data as Employee;
    },
    enabled: !!employeeId,
  });

  // Fetch today's time clock entry
  const { data: todayEntry } = useQuery({
    queryKey: ["timeclock-today", employeeId],
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
      return data as TimeClockEntry | null;
    },
    enabled: !!employeeId,
    refetchInterval: 30000,
  });

  // Fetch shift settings
  const { data: shiftSettings } = useQuery({
    queryKey: ["shift-settings", employee?.campaign_id],
    queryFn: async () => {
      if (!employee?.campaign_id) return null;
      const { data, error } = await supabase
        .from("shift_settings")
        .select("*")
        .eq("campaign_id", employee.campaign_id)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data as ShiftSettings | null;
    },
    enabled: !!employee?.campaign_id,
  });

  // Fetch this week's entries
  const { data: weekEntries = [] } = useQuery({
    queryKey: ["timeclock-week", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("time_clock")
        .select("*")
        .eq("employee_id", employeeId)
        .gte("date", startOfWeek.toISOString().split("T")[0])
        .order("date", { ascending: false });
      if (error) throw error;
      return (data || []) as TimeClockEntry[];
    },
    enabled: !!employeeId,
    refetchInterval: 30000,
  });

  // Clock in mutation
  const clockInMutation = useMutation({
    mutationFn: async () => {
      if (!employeeId || !employee?.campaign_id) throw new Error("Missing information");

      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const clockInTime = now.toISOString();

      // Check if already clocked in
      const { data: existing } = await supabase
        .from("time_clock")
        .select("id")
        .eq("employee_id", employeeId)
        .eq("date", today)
        .maybeSingle();

      if (existing) throw new Error("Already clocked in today");

      // Calculate if late
      let isLate = false;
      let lateMinutes = 0;

      if (shiftSettings) {
        const [shiftHour, shiftMinute] = shiftSettings.start_time.split(":").map(Number);
        const shiftStart = new Date();
        shiftStart.setHours(shiftHour, shiftMinute, 0, 0);
        const lateTime = new Date(shiftStart.getTime() + shiftSettings.grace_minutes * 60000);

        if (now > lateTime) {
          isLate = true;
          lateMinutes = Math.floor((now.getTime() - lateTime.getTime()) / 60000);
        }
      }

      const { data, error } = await supabase
        .from("time_clock")
        .insert({
          employee_id: employeeId,
          clock_in: clockInTime,
          date: today,
          is_late: isLate,
          late_minutes: isLate ? lateMinutes : null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeclock-today"] });
      queryClient.invalidateQueries({ queryKey: ["timeclock-week"] });
    },
  });

  // Clock out mutation
  const clockOutMutation = useMutation({
    mutationFn: async () => {
      if (!todayEntry?.id) throw new Error("No hay entrada registrada");

      const now = new Date();
      const clockOutTime = now.toISOString();

      const clockInDate = new Date(todayEntry.clock_in);
      const totalHours = (now.getTime() - clockInDate.getTime()) / (1000 * 60 * 60);

      const { data, error } = await supabase
        .from("time_clock")
        .update({
          clock_out: clockOutTime,
          total_hours: parseFloat(totalHours.toFixed(2)),
        })
        .eq("id", todayEntry.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeclock-today"] });
      queryClient.invalidateQueries({ queryKey: ["timeclock-week"] });
    },
  });

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTimeFromString = (timeStr: string) => {
    const date = new Date(timeStr);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const calculateElapsedTime = (clockInStr: string) => {
    const clockIn = new Date(clockInStr);
    const elapsed = currentTime.getTime() - clockIn.getTime();
    const hours = Math.floor(elapsed / (1000 * 60 * 60));
    const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const weekTotalHours = weekEntries.reduce((sum, entry) => sum + (entry.total_hours || 0), 0);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!employeeId) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Timeclock</h2>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <p className="text-yellow-800">
              Your account is not linked to an employee. Contact your administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isClockedIn = !!todayEntry && !todayEntry.clock_out;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Timeclock</h2>

      {/* Current Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>Current Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Current Time */}
          <div className="text-center">
            <div className="text-5xl font-bold font-mono text-blue-600 mb-2">
              {formatTime(currentTime)}
            </div>
            <div className="text-lg text-muted-foreground capitalize">
              {formatDate(currentTime)}
            </div>
          </div>

          {/* Clock Status */}
          {isClockedIn ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Clock In</div>
                  <div className="text-2xl font-bold">
                    {formatTimeFromString(todayEntry!.clock_in)}
                  </div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Elapsed Time</div>
                  <div className="text-2xl font-bold text-green-600">
                    {calculateElapsedTime(todayEntry!.clock_in)}
                  </div>
                </div>
              </div>

              {todayEntry?.is_late && (
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-semibold">
                      Late Entry: {todayEntry.late_minutes} minutes
                    </span>
                  </div>
                </div>
              )}

              <Button
                size="lg"
                className="w-full h-12 bg-red-600 hover:bg-red-700 text-white text-lg"
                onClick={() => clockOutMutation.mutate()}
                disabled={clockOutMutation.isPending}
              >
                <LogOut className="mr-2 h-5 w-5" />
                {clockOutMutation.isPending ? "Processing..." : "Clock Out"}
              </Button>
            </div>
          ) : (
            <div>
              <Button
                size="lg"
                className="w-full h-12 bg-green-600 hover:bg-green-700 text-white text-lg"
                onClick={() => clockInMutation.mutate()}
                disabled={clockInMutation.isPending}
              >
                <LogIn className="mr-2 h-5 w-5" />
                {clockInMutation.isPending ? "Processing..." : "Clock In"}
              </Button>
            </div>
          )}

          {clockInMutation.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {(clockInMutation.error as Error).message}
            </div>
          )}
          {clockOutMutation.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {(clockOutMutation.error as Error).message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            This Week's History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Date</TableHeader>
                  <TableHeader>Clock In</TableHeader>
                  <TableHeader>Clock Out</TableHeader>
                  <TableHeader className="text-right">Hours Worked</TableHeader>
                  <TableHeader>Status</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {weekEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                      No records this week
                    </TableCell>
                  </TableRow>
                ) : (
                  weekEntries.map((entry) => (
                    <TableRow key={entry.id} className={entry.is_late ? "bg-red-50" : ""}>
                      <TableCell>
                        {new Date(entry.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell>{formatTimeFromString(entry.clock_in)}</TableCell>
                      <TableCell>
                        {entry.clock_out
                          ? formatTimeFromString(entry.clock_out)
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.total_hours ? entry.total_hours.toFixed(2) : "-"}
                      </TableCell>
                      <TableCell>
                        {entry.is_late ? (
                          <Badge variant="destructive">
                            Late {entry.late_minutes}m
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-50">
                            On Time
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {weekEntries.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Weekly Total Hours:</span>
                <span className="text-lg font-bold">
                  {weekTotalHours.toFixed(2)} hours
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
