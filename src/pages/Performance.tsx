import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle, Calendar } from "lucide-react";

const CAMPAIGNS = [
  { id: "all", name: "Todas" },
  { id: "torro", name: "Torro" },
  { id: "btc", name: "BTC" },
  { id: "scoop", name: "Scoop" },
  { id: "hfb", name: "HFB" },
];

const SPANISH_DAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

interface EODLog {
  id: string;
  employee_id: string;
  date: string;
  campaign_id: string;
  metrics: Record<string, number | string>;
  notes: string | null;
  created_at: string;
  employees: { full_name: string };
}

interface Employee {
  id: string;
  full_name: string;
  is_active: boolean;
}

interface KPIConfig {
  campaign_id: string;
  field_name: string;
  field_label: string;
  min_target: number;
  display_order: number;
  is_active: boolean;
}

export default function Performance() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");

  // Check authorization
  useEffect(() => {
    if (user && user.role === "employee") {
      // Will show error message in UI
    }
  }, [user]);

  // Fetch EOD logs for selected date
  const { data: eodLogs = [] } = useQuery({
    queryKey: ["eod_logs", selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eod_logs")
        .select(
          `
          id,
          employee_id,
          date,
          campaign_id,
          metrics,
          notes,
          created_at,
          employees:employee_id (full_name)
        `
        )
        .eq("date", selectedDate);

      if (error) throw error;
      return (data || []) as EODLog[];
    },
    enabled: user?.role !== "employee",
  });

  // Fetch all active employees
  const { data: employees = [] } = useQuery({
    queryKey: ["active_employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, is_active")
        .eq("is_active", true);

      if (error) throw error;
      return (data || []) as Employee[];
    },
    enabled: user?.role !== "employee",
  });

  // Fetch KPI configurations
  const { data: kpiConfigs = [] } = useQuery({
    queryKey: ["campaign_kpi_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_kpi_config")
        .select("campaign_id, field_name, field_label, min_target, display_order, is_active")
        .eq("is_active", true)
        .order("campaign_id")
        .order("display_order");

      if (error) throw error;
      return (data || []) as KPIConfig[];
    },
    enabled: user?.role !== "employee",
  });

  // Group KPI configs by campaign
  const kpisByCampaign = useMemo(() => {
    const grouped: Record<string, KPIConfig[]> = {};
    kpiConfigs.forEach((kpi) => {
      if (!grouped[kpi.campaign_id]) {
        grouped[kpi.campaign_id] = [];
      }
      grouped[kpi.campaign_id].push(kpi);
    });
    return grouped;
  }, [kpiConfigs]);

  // Get current campaign's KPI fields
  const currentCampaignId =
    selectedCampaign === "all"
      ? (kpiConfigs[0]?.campaign_id || "torro")
      : selectedCampaign;
  const currentKPIs = kpisByCampaign[currentCampaignId] || [];

  // Filter logs by selected campaign
  const filteredLogs = useMemo(() => {
    if (selectedCampaign === "all") {
      return eodLogs;
    }
    return eodLogs.filter((log) => log.campaign_id === selectedCampaign);
  }, [eodLogs, selectedCampaign]);

  // Create map of submitted employees for faster lookup
  const submittedEmployeeIds = useMemo(() => {
    return new Set(filteredLogs.map((log) => log.employee_id));
  }, [filteredLogs]);

  // Combine submitted and non-submitted employees
  const displayedEmployees = useMemo(() => {
    const submitted = filteredLogs.map((log) => ({
      ...log.employees,
      id: log.employee_id,
      submittedLog: log,
    }));

    const notSubmitted = employees
      .filter((emp) => !submittedEmployeeIds.has(emp.id))
      .map((emp) => ({
        id: emp.id,
        full_name: emp.full_name,
        submittedLog: null,
      }));

    return [...submitted, ...notSubmitted].sort((a, b) =>
      a.full_name.localeCompare(b.full_name)
    );
  }, [filteredLogs, employees, submittedEmployeeIds]);

  // Calculate summary metrics
  const totalSubmissions = filteredLogs.length;
  const activeEmployees = employees.length;
  const complianceRate =
    activeEmployees > 0
      ? Math.round((totalSubmissions / activeEmployees) * 100)
      : 0;

  // Format date with day of week
  const dateObj = new Date(selectedDate);
  const dayOfWeek = SPANISH_DAYS[dateObj.getDay()];
  const formattedDate = `${dayOfWeek}, ${dateObj.toLocaleDateString("es-ES")}`;

  // Check access
  if (user && user.role === "employee") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Desempeño</h1>
        </div>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-center text-red-800">No tienes acceso a esta página.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Desempeño</h1>
        <p className="text-muted-foreground mt-2">
          Revisa los reportes de fin de día por campaña
        </p>
      </div>

      {/* Date Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Selector de Fecha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-xs">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="text-lg font-medium text-gray-700">
              {formattedDate}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Reportes Enviados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalSubmissions}</div>
            <p className="text-xs text-gray-500 mt-1">para {formattedDate}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Empleados Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeEmployees}</div>
            <p className="text-xs text-gray-500 mt-1">en total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Tasa de Cumplimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{complianceRate}%</div>
            <p className="text-xs text-gray-500 mt-1">
              {totalSubmissions} de {activeEmployees}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Table with Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Reporte de Desempeño</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            value={selectedCampaign}
            onValueChange={setSelectedCampaign}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-5">
              {CAMPAIGNS.map((campaign) => (
                <TabsTrigger key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {CAMPAIGNS.map((campaign) => (
              <TabsContent key={campaign.id} value={campaign.id} className="mt-4">
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">Nombre</TableHead>
                        {currentKPIs.map((kpi) => (
                          <TableHead
                            key={kpi.field_name}
                            className="text-center font-semibold"
                          >
                            {kpi.field_label}
                          </TableHead>
                        ))}
                        <TableHead className="font-semibold">Notas</TableHead>
                        <TableHead className="text-center font-semibold">
                          Hora de Envío
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedEmployees.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={currentKPIs.length + 3}
                            className="text-center py-8 text-gray-500"
                          >
                            No hay datos para mostrar
                          </TableCell>
                        </TableRow>
                      ) : (
                        displayedEmployees.map((emp) => {
                          const submitted = emp.submittedLog;
                          const isGrayed = !submitted;

                          return (
                            <TableRow
                              key={emp.id}
                              className={
                                isGrayed
                                  ? "bg-gray-50 opacity-60"
                                  : "hover:bg-gray-50"
                              }
                            >
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {emp.full_name}
                                  {isGrayed && (
                                    <Badge variant="secondary">
                                      Sin reporte
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>

                              {currentKPIs.map((kpi) => {
                                if (isGrayed) {
                                  return (
                                    <TableCell
                                      key={kpi.field_name}
                                      className="text-center text-gray-400"
                                    >
                                      —
                                    </TableCell>
                                  );
                                }

                                const value = submitted?.metrics[kpi.field_name];
                                const numValue = Number(value) || 0;
                                const isBelowTarget = numValue < kpi.min_target;

                                return (
                                  <TableCell
                                    key={kpi.field_name}
                                    className={`text-center font-medium ${
                                      isBelowTarget
                                        ? "bg-red-100 text-red-900"
                                        : "bg-green-100 text-green-900"
                                    }`}
                                  >
                                    <div className="flex items-center justify-center gap-1">
                                      {isBelowTarget ? (
                                        <AlertTriangle className="h-4 w-4" />
                                      ) : (
                                        <CheckCircle className="h-4 w-4" />
                                      )}
                                      {numValue}
                                    </div>
                                  </TableCell>
                                );
                              })}

                              <TableCell className="text-sm text-gray-600 max-w-xs truncate">
                                {submitted?.notes || "—"}
                              </TableCell>

                              <TableCell className="text-center text-sm text-gray-500">
                                {submitted
                                  ? new Date(submitted.created_at).toLocaleTimeString(
                                      "es-ES",
                                      {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      }
                                    )
                                  : "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
