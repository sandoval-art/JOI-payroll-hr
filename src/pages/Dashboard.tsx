import { useEmployees, useActivePeriod, usePayrollRecords, useCreatePeriod, getCurrentPeriodDates, formatPeriodLabel, recordToConfig, useUpsertPayrollRecord } from "@/hooks/useSupabasePayroll";
import { calcularNomina } from "@/types/payroll";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Users, DollarSign, TrendingUp, Calculator, Upload, Pencil, ChevronDown, ChevronUp, AlertTriangle, UserPlus } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { getPayrollCutoffInfo, formatDateES, type PayrollCutoffInfo } from "@/utils/payrollCutoff";
import { parseTCW, type TCWResult } from "@/utils/tcwParser";

export default function Dashboard() {
  const { data: employees = [], isLoading: loadingEmps } = useEmployees();
  const { data: activePeriod, isLoading: loadingPeriod } = useActivePeriod();
  const createPeriod = useCreatePeriod();
  const { data: records = [] } = usePayrollRecords(activePeriod?.id);
  const upsertPayrollRecord = useUpsertPayrollRecord();

  // ========== State for Payroll Cutoff ==========
  const [cutoffInfo, setCutoffInfo] = useState<PayrollCutoffInfo | null>(null);
  const [cutoffOverrideOpen, setCutoffOverrideOpen] = useState(false);
  const [cutoffOverrideDate, setCutoffOverrideDate] = useState("");
  const [overriddenCutoff, setOverriddenCutoff] = useState<Date | null>(null);

  // ========== State for TCW Upload ==========
  const [tcwAlerts, setTcwAlerts] = useState<TCWResult[]>([]);
  const [tcwAlertCount, setTcwAlertCount] = useState(0);
  const [tcwCollapsed, setTcwCollapsed] = useState(true);
  const tcwFileInputRef = useRef<HTMLInputElement>(null);

  // ========== State for Spiff Upload ==========
  const [spiffPreviewOpen, setSpiffPreviewOpen] = useState(false);
  const [spiffPreviewData, setSpiffPreviewData] = useState<Array<{ agentName: string; matchedEmployee: string | null; amount: number }>>([]);
  const [spiffCampaignName, setSpiffCampaignName] = useState("");
  const [spiffFileInputRef] = useState(useRef<HTMLInputElement>(null));
  const [isApplyingSpiff, setIsApplyingSpiff] = useState(false);

  // Auto-create period if none exists
  useEffect(() => {
    if (!loadingPeriod && !activePeriod && !createPeriod.isPending) {
      createPeriod.mutate(getCurrentPeriodDates());
    }
  }, [loadingPeriod, activePeriod]);

  // Initialize cutoff info
  useEffect(() => {
    setCutoffInfo(getPayrollCutoffInfo());
  }, []);

  const periodLabel = formatPeriodLabel(activePeriod);

  const totalNomina = employees.reduce((sum, emp) => {
    const rec = records.find((r: any) => r.employee_id === emp._uuid);
    const config = recordToConfig(rec, emp.id);
    return sum + calcularNomina(emp, config).netoAPagar;
  }, 0);

  const promedioSalarial = employees.length
    ? employees.reduce((s, e) => s + e.sueldoBase, 0) / employees.length
    : 0;

  const fmt = (n: number) =>
    n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

  const cards = [
    { title: "Total Empleados", value: employees.length, icon: Users, format: false },
    { title: "Nómina Quincenal", value: totalNomina, icon: DollarSign, format: true },
    { title: "Promedio Salarial", value: promedioSalarial, icon: TrendingUp, format: true },
    { title: "Periodo Actual", value: periodLabel, icon: Calculator, format: false },
  ];

  // ========== Payroll Cutoff Handlers ==========
  const getCutoffColor = (urgency: string) => {
    switch (urgency) {
      case "normal":
        return "bg-blue-50 border-blue-200";
      case "soon":
        return "bg-yellow-50 border-yellow-200";
      case "urgent":
        return "bg-red-50 border-red-200";
      case "overdue":
        return "bg-red-900 border-red-900";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const getCutoffTextColor = (urgency: string) => {
    return urgency === "overdue" ? "text-white" : "text-gray-900";
  };

  const handleCutoffOverride = () => {
    if (cutoffOverrideDate) {
      const newDate = new Date(cutoffOverrideDate);
      setOverriddenCutoff(newDate);
      setCutoffOverrideOpen(false);
      setCutoffOverrideDate("");
    }
  };

  const handleResetCutoff = () => {
    setOverriddenCutoff(null);
  };

  // ========== TCW Upload Handlers ==========
  const handleTCWUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const csv = event.target?.result as string;
      const knownEmployeeNames = employees.map((e) => e.nombre);
      const results = parseTCW(csv, knownEmployeeNames);
      setTcwAlerts(results);

      // Count non-ok alerts
      const alertCount = results.filter((r) => r.status !== "ok").length;
      setTcwAlertCount(alertCount);
      setTcwCollapsed(false);
    };
    reader.readAsText(file);
  };

  const handleTCWFileClick = () => {
    tcwFileInputRef.current?.click();
  };

  // ========== Spiff Upload Handlers ==========
  const handleSpiffUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files || files.length === 0) return;

    let allPreviewData: Array<{ agentName: string; matchedEmployee: string | null; amount: number }> = [];

    // Process all selected files
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const csv = event.target?.result as string;
        const rows = csv.split("\n").map((line) => line.trim()).filter((line) => line);

        if (rows.length > 1) {
          // Skip header if present, assume first column = agent name, second = amount
          const dataRows = rows.slice(1);
          const knownEmployeeNames = employees.map((e) => e.nombre);

          dataRows.forEach((row) => {
            const cols = row.split(",").map((c) => c.trim());
            if (cols.length >= 2) {
              const agentName = cols[0];
              const amountStr = cols[1];
              const amount = parseFloat(amountStr) || 0;

              // Try to match agent name to known employee
              const normalizedAgent = agentName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              const matched = knownEmployeeNames.find(
                (e) => e.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === normalizedAgent
              ) || null;

              allPreviewData.push({
                agentName,
                matchedEmployee: matched,
                amount,
              });
            }
          });
        }

        // Set preview data
        setSpiffPreviewData(allPreviewData);
        setSpiffCampaignName(file.name.replace(/\.csv$/, ""));
        setSpiffPreviewOpen(true);
      };
      reader.readAsText(file);
    });
  };

  const handleConfirmSpiff = async () => {
    if (!activePeriod) return;

    setIsApplyingSpiff(true);
    try {
      for (const item of spiffPreviewData) {
        if (item.matchedEmployee) {
          const emp = employees.find((e) => e.nombre === item.matchedEmployee);
          if (emp) {
            await upsertPayrollRecord.mutateAsync({
              employee_id: emp._uuid,
              period_id: activePeriod.id,
              additional_bonuses: item.amount,
            });
          }
        }
      }
      setSpiffPreviewOpen(false);
      setSpiffPreviewData([]);
      setSpiffCampaignName("");
    } finally {
      setIsApplyingSpiff(false);
    }
  };

  const handleSpiffFileClick = () => {
    spiffFileInputRef.current?.click();
  };

  if (loadingEmps) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Cargando...</div>;
  }

  const displayCutoffDate = overriddenCutoff || cutoffInfo?.suggestedCutoff;
  const displayCutoffUrgency = overriddenCutoff ? cutoffInfo?.urgency : cutoffInfo?.urgency;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      {/* ========== PAYROLL CUTOFF BANNER ========== */}
      {cutoffInfo && (
        <div className={`border rounded-lg p-4 ${getCutoffColor(displayCutoffUrgency || "")}`}>
          <div className={`${getCutoffTextColor(displayCutoffUrgency || "")} space-y-2`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">Periodo Actual</p>
                <p className="text-xs opacity-90">{cutoffInfo.periodLabel}</p>
              </div>
              <div>
                <p className="font-semibold text-sm">Fecha de Pago</p>
                <p className="text-xs opacity-90">{formatDateES(cutoffInfo.payday)}</p>
              </div>
              <div>
                <p className="font-semibold text-sm">Corte Sugerido</p>
                <p className="text-xs opacity-90">
                  {formatDateES(displayCutoffDate || cutoffInfo.suggestedCutoff)}
                  {overriddenCutoff && " (fecha ajustada)"}
                </p>
              </div>
              <div>
                <p className="font-semibold text-sm">Días Restantes</p>
                <p className="text-xs opacity-90">{cutoffInfo.daysUntilCutoff} días</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCutoffOverrideOpen(true)}
                  className={`p-1.5 rounded hover:opacity-80 transition ${getCutoffTextColor(displayCutoffUrgency || "")}`}
                  title="Ajustar fecha de corte"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                {overriddenCutoff && (
                  <button
                    onClick={handleResetCutoff}
                    className={`text-xs underline hover:opacity-80 transition ${getCutoffTextColor(displayCutoffUrgency || "")}`}
                  >
                    Reiniciar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== CUTOFF OVERRIDE DIALOG ========== */}
      <Dialog open={cutoffOverrideOpen} onOpenChange={setCutoffOverrideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar Fecha de Corte</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              type="date"
              value={cutoffOverrideDate}
              onChange={(e) => setCutoffOverrideDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCutoffOverrideOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCutoffOverride}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== SUMMARY CARDS ========== */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {typeof c.value === "number" && c.format ? fmt(c.value) : c.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ========== TCW & SPIFF UPLOAD BUTTONS ========== */}
      <div className="flex gap-2">
        <Button
          onClick={handleTCWFileClick}
          variant="outline"
          className="gap-2"
        >
          <Upload className="h-4 w-4" />
          Subir Timesheet TCW
          {tcwAlertCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {tcwAlertCount}
            </Badge>
          )}
        </Button>
        <input
          ref={tcwFileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleTCWUpload}
        />

        <Button
          onClick={handleSpiffFileClick}
          variant="outline"
          className="gap-2"
        >
          <Upload className="h-4 w-4" />
          Subir Spiffs
        </Button>
        <input
          ref={spiffFileInputRef}
          type="file"
          accept=".csv"
          multiple
          className="hidden"
          onChange={handleSpiffUpload}
        />
      </div>

      {/* ========== TCW ALERTS SECTION ========== */}
      {tcwAlerts.length > 0 && (
        <Card>
          <Collapsible open={!tcwCollapsed} onOpenChange={(open) => setTcwCollapsed(!open)}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Alertas TCW</CardTitle>
                  {tcwCollapsed ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="space-y-3">
                  {tcwAlerts.map((alert, idx) => {
                    const badgeColor =
                      alert.status === "critical"
                        ? "destructive"
                        : alert.status === "warning"
                        ? "secondary"
                        : alert.status === "new"
                        ? "default"
                        : "outline";

                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 border rounded-md"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{alert.name}</span>
                            <Badge variant={badgeColor} className="text-xs">
                              {alert.status === "critical"
                                ? "Crítico"
                                : alert.status === "warning"
                                ? "Advertencia"
                                : alert.status === "new"
                                ? "Nuevo"
                                : "OK"}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>Horas totales: {alert.totalHours.toFixed(1)}</p>
                            {alert.hoursDeficit > 0 && (
                              <p className="text-red-600">Déficit: {alert.hoursDeficit.toFixed(1)} horas</p>
                            )}
                          </div>
                        </div>
                        {alert.matchedEmployee && (
                          <a
                            href={`/employees/${alert.matchedEmployee}`}
                            className="text-xs text-blue-600 hover:underline ml-4"
                          >
                            Ver Perfil
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* ========== SPIFF PREVIEW DIALOG ========== */}
      <Dialog open={spiffPreviewOpen} onOpenChange={setSpiffPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vista Previa - {spiffCampaignName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {spiffPreviewData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay datos para mostrar</p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">Nombre Agente</th>
                      <th className="text-left p-2 font-medium">Empleado Coincidente</th>
                      <th className="text-right p-2 font-medium">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spiffPreviewData.map((item, idx) => (
                      <tr
                        key={idx}
                        className={`border-b last:border-0 ${
                          !item.matchedEmployee ? "bg-yellow-50" : ""
                        }`}
                      >
                        <td className="p-2">{item.agentName}</td>
                        <td className="p-2">
                          {item.matchedEmployee ? (
                            <span className="text-green-700">{item.matchedEmployee}</span>
                          ) : (
                            <span className="text-yellow-700 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              No coincide
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-right font-semibold">{fmt(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSpiffPreviewOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmSpiff}
              disabled={isApplyingSpiff}
            >
              {isApplyingSpiff ? "Procesando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== EMPLOYEE PAYROLL TABLE ========== */}
      {employees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumen Quincenal — {periodLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium text-muted-foreground">ID</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Nombre</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Sueldo Base</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Neto Quincenal</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => {
                    const rec = records.find((r: any) => r.employee_id === emp._uuid);
                    const config = recordToConfig(rec, emp.id);
                    const result = calcularNomina(emp, config);
                    return (
                      <tr key={emp.id} className="border-b last:border-0">
                        <td className="p-2">{emp.id}</td>
                        <td className="p-2">{emp.nombre}</td>
                        <td className="p-2 text-right">{fmt(emp.sueldoBase)}</td>
                        <td className="p-2 text-right font-semibold">{fmt(result.netoAPagar)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
