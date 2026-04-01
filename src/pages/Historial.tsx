import { useState } from "react";
import { useEmployees, useActivePeriod, usePayrollRecords, useClosePeriod, useCreatePeriod, useHistoryRecords, getCurrentPeriodDates, formatPeriodLabel, recordToConfig } from "@/hooks/useSupabasePayroll";
import { calcularNomina, type PayrollRecord } from "@/types/payroll";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Download, Lock, Search } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

const fmt = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

interface HistoryDisplayRecord {
  id: string;
  periodLabel: string;
  employeeName: string;
  employeeId: string;
  netPay: number;
  closedDate: string;
  sueldoBase: number;
  config: {
    diasFaltados: number;
    diasExtra: number;
    kpiAplicado: boolean;
    primaDominical: boolean;
    diaFestivo: boolean;
    bonosAdicionales: number;
  };
  result: any;
}

function generatePDF(record: HistoryDisplayRecord) {
  const doc = new jsPDF();
  const r = record.result;

  doc.setFontSize(18);
  doc.text("Recibo de Nómina", 20, 20);
  doc.setFontSize(11);
  doc.text(`Periodo: ${record.periodLabel}`, 20, 30);
  doc.text(`Fecha de cierre: ${record.closedDate}`, 20, 37);
  doc.text(`Empleado: ${record.employeeName} (${record.employeeId})`, 20, 47);
  doc.text(`Sueldo Base Mensual: ${fmt(record.sueldoBase)}`, 20, 57);

  let y = 70;
  doc.setFontSize(13);
  doc.text("Desglose", 20, y); y += 10;
  doc.setFontSize(10);

  const lines = [
    ["Sueldo Quincenal (Base/2)", fmt(r.sueldoQuincenal)],
    ["", ""],
    ["RETENCIONES", ""],
    [`Faltas (${record.config.diasFaltados} días)`, `-${fmt(r.descuentoFaltas)}`],
    ["", ""],
    ["EXTRAS", ""],
    ["KPI", `+${fmt(r.montoKpi)}`],
    [`Días Extra (${record.config.diasExtra})`, `+${fmt(r.montoDiasExtra)}`],
    ["Prima Dominical", `+${fmt(r.montoPrimaDominical)}`],
    ["Día Festivo", `+${fmt(r.montoDiaFestivo)}`],
    ["Bonos Adicionales", `+${fmt(r.bonosAdicionales)}`],
    ["", ""],
    ["Total Retenciones", `-${fmt(r.totalRetenciones)}`],
    ["Total Extras", `+${fmt(r.totalExtras)}`],
  ];

  lines.forEach(([label, val]) => {
    if (label === "") { y += 3; return; }
    if (label === "RETENCIONES" || label === "EXTRAS") {
      doc.setFont("helvetica", "bold");
      doc.text(label, 20, y);
      doc.setFont("helvetica", "normal");
    } else {
      doc.text(label, 25, y);
      doc.text(val, 170, y, { align: "right" });
    }
    y += 7;
  });

  y += 5;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("NETO A PAGAR", 20, y);
  doc.text(fmt(r.netoAPagar), 170, y, { align: "right" });

  doc.save(`nomina_${record.employeeId}_${record.periodLabel.replace(/ /g, "_")}.pdf`);
}

export default function Historial() {
  const { data: employees = [] } = useEmployees();
  const { data: activePeriod } = useActivePeriod();
  const { data: activeRecords = [] } = usePayrollRecords(activePeriod?.id);
  const { data: historyData = [], isLoading } = useHistoryRecords();
  const closePeriod = useClosePeriod();
  const createPeriod = useCreatePeriod();
  const [search, setSearch] = useState("");

  const periodLabel = formatPeriodLabel(activePeriod);

  const handleCerrarQuincena = () => {
    if (!activePeriod) return;

    // First, ensure all employees have records with calculated_net_pay
    closePeriod.mutate(activePeriod.id, {
      onSuccess: () => {
        // Create next period
        createPeriod.mutate(getCurrentPeriodDates());
        toast.success(`Quincena "${periodLabel}" cerrada con ${employees.length} registros`);
      },
      onError: (err: any) => toast.error(err.message || "Error al cerrar quincena"),
    });
  };

  // Transform history data for display
  const historyRecords: HistoryDisplayRecord[] = historyData.map((rec: any) => {
    const emp = {
      id: rec.employees.employee_id,
      nombre: rec.employees.full_name,
      sueldoBase: Number(rec.employees.monthly_base_salary) || 0,
      descuentoPorDia: Number(rec.employees.daily_discount_rate) || 0,
      kpiMonto: Number(rec.employees.kpi_bonus_amount) || 0,
      turno: "Lunes-Viernes" as const,
    };
    const config = recordToConfig(rec, emp.id);
    const result = calcularNomina(emp, config);

    return {
      id: rec.id,
      periodLabel: formatPeriodLabel(rec.payroll_periods),
      employeeName: rec.employees.full_name,
      employeeId: rec.employees.employee_id,
      netPay: result.netoAPagar,
      closedDate: new Date(rec.updated_at).toLocaleDateString("es-MX"),
      sueldoBase: emp.sueldoBase,
      config: {
        diasFaltados: rec.days_absent || 0,
        diasExtra: rec.extra_days_count || 0,
        kpiAplicado: rec.kpi_achieved || false,
        primaDominical: rec.sunday_premium_applied || false,
        diaFestivo: rec.holiday_worked || false,
        bonosAdicionales: Number(rec.additional_bonuses) || 0,
      },
      result,
    };
  });

  const filtered = historyRecords.filter(
    (r) =>
      r.periodLabel.toLowerCase().includes(search.toLowerCase()) ||
      r.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      r.employeeId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">Historial de Nómina</h2>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={employees.length === 0 || !activePeriod || closePeriod.isPending}>
              <Lock className="mr-2 h-4 w-4" /> Cerrar Quincena
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Cerrar quincena actual?</AlertDialogTitle>
              <AlertDialogDescription>
                Se guardará un snapshot de la nómina de {employees.length} empleados para el periodo "{periodLabel}".
                Las incidencias se resetearán para la siguiente quincena.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleCerrarQuincena}>Cerrar Quincena</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por periodo, nombre o ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Periodo</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead>Fecha Cierre</TableHead>
                <TableHead className="text-right">Neto</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {isLoading ? "Cargando..." : "No hay registros en el historial"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((rec) => (
                  <TableRow key={rec.id}>
                    <TableCell className="font-medium">{rec.periodLabel}</TableCell>
                    <TableCell>{rec.employeeName} ({rec.employeeId})</TableCell>
                    <TableCell className="text-muted-foreground">{rec.closedDate}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(rec.netPay)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => generatePDF(rec)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
