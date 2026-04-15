import { useEffect, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Clock, AlertTriangle, UserCheck, UserX } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  campaign_id: string;
  campaign_name: string;
  clock_in: string | null;
  clock_out: string | null;
  is_late: boolean;
  minutes_late: number | null;
  created_at: string;
}

interface EmployeeWithAttendance {
  id: string;
  name: string;
  campaign_id: string;
  campaign_name: string;
  status: "presente" | "ausente" | "completado";
  clock_in: string | null;
  clock_out: string | null;
  is_late: boolean;
  minutes_late: number | null;
  is_repeat_late: boolean;
}

interface OverviewStats {
  presentes: number;
  ausentes: number;
  tardanzas_hoy: number;
  tardanzas_repetidas: number;
}

export default function Attendance() {
  const { user, role, employeeId, isLeadership, isTeamLead } = useAuth();
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([]);

  // Check authorization
  if (role === "agent") {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">You don't have access to this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch campaigns (scoped for TLs)
  const { data: campaignsData } = useQuery({
    queryKey: ["attendance-campaigns", employeeId, isLeadership, isTeamLead],
    queryFn: async () => {
      let q = supabase.from("campaigns").select("id, name").order("name");
      if (isTeamLead && !isLeadership) {
        q = q.eq("team_lead_id", employeeId!);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (campaignsData) {
      setCampaigns(campaignsData);
    }
  }, [campaignsData]);

  // Fetch attendance data for today
  const { data: attendanceData, refetch } = useQuery({
    queryKey: ["attendance", selectedCampaign, employeeId, isLeadership, isTeamLead],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: timeClock, error: timeClockError } = await supabase
        .from("time_clock")
        .select(
          `
          id,
          employee_id,
          employees:employee_id (name),
          clock_in,
          clock_out,
          is_late,
          minutes_late,
          created_at
        `
        )
        .gte("created_at", today.toISOString())
        .lt("created_at", new Date(today.getTime() + 86400000).toISOString());

      if (timeClockError) throw timeClockError;

      // Fetch employees scoped by role
      let employeesQuery = supabase
        .from("employees")
        .select("id, full_name, campaign_id")
        .eq("is_active", true);

      if (isTeamLead && employeeId) {
        employeesQuery = employeesQuery.eq("reports_to", employeeId);
      }

      const { data: employees, error: employeesError } = await employeesQuery;

      if (employeesError) throw employeesError;

      // Fetch clients for campaign names
      const { data: campaignsList, error: campaignsError } = await supabase
        .from("campaigns")
        .select("id, name");

      if (campaignsError) throw campaignsError;

      const campaignMap = new Map(campaignsList.map((c: any) => [c.id, c.name]));

      // Get repeat lates for this week
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());

      const { data: weekLates, error: weekLatesError } = await supabase
        .from("time_clock")
        .select("employee_id")
        .eq("is_late", true)
        .gte("created_at", weekStart.toISOString())
        .lt("created_at", new Date(today.getTime() + 86400000).toISOString());

      if (weekLatesError) throw weekLatesError;

      const lateCountMap = new Map<string, number>();
      weekLates?.forEach((record: any) => {
        lateCountMap.set(
          record.employee_id,
          (lateCountMap.get(record.employee_id) || 0) + 1
        );
      });

      // Build attendance map from today's time clock
      const attendanceMap = new Map<string, any>();
      timeClock?.forEach((record: any) => {
        attendanceMap.set(record.employee_id, record);
      });

      // Build employee list with attendance status
      const employeeList: EmployeeWithAttendance[] = employees.map(
        (emp: any) => {
          const attendance = attendanceMap.get(emp.id);
          const campaignName = campaignMap.get(emp.campaign_id) || "Unknown";
          const isRepeatLate = (lateCountMap.get(emp.id) || 0) > 1;

          let status: "presente" | "ausente" | "completado" = "ausente";
          if (attendance) {
            if (attendance.clock_out) {
              status = "completado";
            } else if (attendance.clock_in) {
              status = "presente";
            }
          }

          return {
            id: emp.id,
            name: emp.full_name,
            campaign_id: emp.campaign_id,
            campaign_name: campaignName,
            status,
            clock_in: attendance?.clock_in || null,
            clock_out: attendance?.clock_out || null,
            is_late: attendance?.is_late || false,
            minutes_late: attendance?.minutes_late || null,
            is_repeat_late: isRepeatLate,
          };
        }
      );

      return employeeList;
    },
    refetchInterval: 30000, // 30 seconds
  });

  // Calculate overview stats
  const stats: OverviewStats = {
    presentes: attendanceData?.filter((e) => e.status === "presente").length || 0,
    ausentes: attendanceData?.filter((e) => e.status === "ausente").length || 0,
    tardanzas_hoy: attendanceData?.filter((e) => e.is_late).length || 0,
    tardanzas_repetidas: attendanceData?.filter((e) => e.is_repeat_late).length || 0,
  };

  // Filter by campaign
  const filteredData = attendanceData?.filter((emp) => {
    if (selectedCampaign === "all") return true;
    return emp.campaign_id === selectedCampaign;
  });

  // Sort: clocked in first, then absent, then completed
  const sortedData = filteredData?.sort((a, b) => {
    const statusOrder = { presente: 0, ausente: 1, completado: 2 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  const formatTime = (isoString: string | null) => {
    if (!isoString) return "-";
    const date = new Date(isoString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const calculateHours = (clockIn: string | null, clockOut: string | null) => {
    if (!clockIn || !clockOut) return "-";
    const start = new Date(clockIn);
    const end = new Date(clockOut);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return hours.toFixed(2);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground mt-2">
          Real-time attendance dashboard
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Presentes */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-green-900">
              <UserCheck className="h-4 w-4" />
              Present
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-700">{stats.presentes}</p>
          </CardContent>
        </Card>

        {/* Ausentes */}
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-red-900">
              <UserX className="h-4 w-4" />
              Absent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-700">{stats.ausentes}</p>
          </CardContent>
        </Card>

        {/* Tardanzas Hoy */}
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-yellow-900">
              <Clock className="h-4 w-4" />
              Late Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-700">
              {stats.tardanzas_hoy}
            </p>
          </CardContent>
        </Card>

        {/* Tardanzas Repetidas */}
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-orange-900">
              <AlertTriangle className="h-4 w-4" />
              Repeat Late
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-700">
              {stats.tardanzas_repetidas}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Live Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Campaign Filter Tabs */}
          <Tabs value={selectedCampaign} onValueChange={setSelectedCampaign} className="mb-4">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              {campaigns.map((campaign) => (
                <TabsTrigger key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Late By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData && sortedData.length > 0 ? (
                  sortedData.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {employee.name}
                          {employee.is_repeat_late && (
                            <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                              Repeat
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{employee.campaign_name}</TableCell>
                      <TableCell>
                        {employee.status === "presente" && (
                          <Badge className="bg-green-600 hover:bg-green-700">
                            Present
                          </Badge>
                        )}
                        {employee.status === "ausente" && (
                          <Badge variant="secondary">Absent</Badge>
                        )}
                        {employee.status === "completado" && (
                          <Badge className="bg-blue-600 hover:bg-blue-700">
                            Completed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatTime(employee.clock_in)}</TableCell>
                      <TableCell>{formatTime(employee.clock_out)}</TableCell>
                      <TableCell>
                        {calculateHours(employee.clock_in, employee.clock_out)}
                      </TableCell>
                      <TableCell>
                        {employee.is_late ? (
                          <Badge variant="destructive">
                            {employee.minutes_late} min
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No attendance data
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
