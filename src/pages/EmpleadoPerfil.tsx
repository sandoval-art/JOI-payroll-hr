import { useParams, useNavigate } from "react-router-dom";
import { useEmployees, useUpdateEmployee, useActivePeriod, usePayrollRecords, useUpsertPayrollRecord, useCreatePeriod, getCurrentPeriodDates, recordToConfig } from "@/hooks/useSupabasePayroll";
import { useClients } from "@/hooks/useInvoices";
import { supabase } from "@/integrations/supabase/client";
import { calcularNomina, type Turno } from "@/types/payroll";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

const fmt = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function EmpleadoPerfil() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: employees = [], isLoading } = useEmployees();
  const updateEmployee = useUpdateEmployee();
  const { data: activePeriod } = useActivePeriod();
  const createPeriod = useCreatePeriod();
  const { data: records = [] } = usePayrollRecords(activePeriod?.id);
  const upsertRecord = useUpsertPayrollRecord();
  const { data: clients = [] } = useClients();
  const queryClient = useQueryClient();

  // Auto-create period if none exists
  useEffect(() => {
    if (!isLoading && !activePeriod && !createPeriod.isPending) {
      createPeriod.mutate(getCurrentPeriodDates());
    }
  }, [isLoading, activePeriod]);

  const emp = employees.find((e) => e.id === id);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Cargando...</div>;
  }

  if (!emp) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">Empleado no encontrado</p>
        <Button variant="outline" onClick={() => navigate("/empleados")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
      </div>
    );
  }

  const currentRecord = records.find((r: any) => r.employee_id === emp._uuid);
  const config = recordToConfig(currentRecord, emp.id);
  const result = calcularNomina(emp, config);

  const saveField = (field: string, value: any) => {
    updateEmployee.mutate(
      { employeeId: emp.id, data: { [field]: value } },
      { onSuccess: () => toast.success("Dato guardado") }
    );
  };

  const saveConfig = (field: string, value: any) => {
    if (!activePeriod || !emp._uuid) return;
    // Map frontend field names to DB columns
    const fieldMap: Record<string, string> = {
      diasFaltados: "days_absent",
      kpiAplicado: "kpi_achieved",
      diasExtra: "extra_days_count",
      primaDominical: "sunday_premium_applied",
      diaFestivo: "holiday_worked",
      bonosAdicionales: "additional_bonuses",
    };
    const dbField = fieldMap[field];
    if (!dbField) return;

    // Build the updated config to calculate net pay
    const updatedConfig = { ...config, [field]: value };
    const updatedResult = calcularNomina(emp, updatedConfig);

    upsertRecord.mutate({
      employee_id: emp._uuid,
      period_id: activePeriod.id,
      days_absent: updatedConfig.diasFaltados,
      extra_days_count: updatedConfig.diasExtra,
      kpi_achieved: updatedConfig.kpiAplicado,
      sunday_premium_applied: updatedConfig.primaDominical,
      holiday_worked: updatedConfig.diaFestivo,
      additional_bonuses: updatedConfig.bonosAdicionales,
      calculated_net_pay: updatedResult.netoAPagar,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <Button variant="ghost" onClick={() => navigate("/empleados")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Empleados
      </Button>

      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-lg">{emp.nombre[0]}</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold">{emp.nombre}</h2>
          <p className="text-muted-foreground">ID: {emp.id} · Turno: {emp.turno}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Configuración Salarial</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Sueldo Base Mensual</Label>
              <Input type="number" value={emp.sueldoBase || ""} onChange={(e) => saveField("sueldoBase", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="grid gap-2">
              <Label>Descuento por Día Faltado</Label>
              <Input type="number" value={emp.descuentoPorDia || ""} onChange={(e) => saveField("descuentoPorDia", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="grid gap-2">
              <Label>KPI (Monto Extra)</Label>
              <Input type="number" value={emp.kpiMonto || ""} onChange={(e) => saveField("kpiMonto", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="grid gap-2">
              <Label>Turno</Label>
              <Select value={emp.turno} onValueChange={(v) => saveField("turno", v as Turno)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Lunes-Jueves">Lunes-Jueves</SelectItem>
                  <SelectItem value="Lunes-Viernes">Lunes-Viernes</SelectItem>
                  <SelectItem value="Viernes-Domingo">Viernes-Domingo</SelectItem>
                  <SelectItem value="Viernes-Lunes">Viernes-Lunes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Sueldo Diario</p>
              <p className="text-xl font-bold">{fmt(result.sueldoDiario)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Incidencias Quincenales</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Días Faltados</Label>
              <Input type="number" min={0} value={config.diasFaltados || ""} onChange={(e) => saveConfig("diasFaltados", parseInt(e.target.value) || 0)} />
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="kpi" checked={config.kpiAplicado} onCheckedChange={(v) => saveConfig("kpiAplicado", !!v)} />
              <Label htmlFor="kpi" className="cursor-pointer">KPI logrado (+{fmt(emp.kpiMonto)})</Label>
            </div>
            <div className="grid gap-2">
              <Label>Días Extra</Label>
              <Select value={String(config.diasExtra)} onValueChange={(v) => saveConfig("diasExtra", parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0,1,2,3,4,5,6,7].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} día{n !== 1 ? "s" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="prima" checked={config.primaDominical} onCheckedChange={(v) => saveConfig("primaDominical", !!v)} />
              <Label htmlFor="prima" className="cursor-pointer">Prima Dominical (25% del sueldo diario)</Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="festivo" checked={config.diaFestivo} onCheckedChange={(v) => saveConfig("diaFestivo", !!v)} />
              <Label htmlFor="festivo" className="cursor-pointer">Día Festivo (triple del sueldo diario)</Label>
            </div>
            <div className="grid gap-2">
              <Label>Bonos Adicionales</Label>
              <Input type="number" min={0} value={config.bonosAdicionales || ""} onChange={(e) => saveConfig("bonosAdicionales", parseFloat(e.target.value) || 0)} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Desglose Quincenal</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <Row label="Sueldo Quincenal (Base/2)" value={fmt(result.sueldoQuincenal)} />
            <Separator />
            <p className="text-sm font-semibold text-destructive">Retenciones</p>
            <Row label={`Faltas (${config.diasFaltados} × ${fmt(emp.descuentoPorDia)})`} value={`-${fmt(result.descuentoFaltas)}`} negative />
            <Separator />
            <p className="text-sm font-semibold text-primary">Extras</p>
            <Row label="KPI" value={`+${fmt(result.montoKpi)}`} />
            <Row label={`Días Extra (${config.diasExtra} × $1,000)`} value={`+${fmt(result.montoDiasExtra)}`} />
            <Row label="Prima Dominical" value={`+${fmt(result.montoPrimaDominical)}`} />
            <Row label="Día Festivo" value={`+${fmt(result.montoDiaFestivo)}`} />
            <Row label="Bonos Adicionales" value={`+${fmt(result.bonosAdicionales)}`} />
            <Separator />
            <div className="flex justify-between items-center p-3 rounded-lg bg-primary/10">
              <span className="font-bold text-lg">Neto a Pagar</span>
              <span className="font-bold text-2xl text-primary">{fmt(result.netoAPagar)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={negative ? "text-destructive" : ""}>{value}</span>
    </div>
  );
}
