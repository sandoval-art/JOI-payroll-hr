import { useEmployees, useActivePeriod, usePayrollRecords, useCreatePeriod, getCurrentPeriodDates, formatPeriodLabel, recordToConfig } from "@/hooks/useSupabasePayroll";
import { calcularNomina } from "@/types/payroll";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, TrendingUp, Calculator } from "lucide-react";
import { useEffect } from "react";

export default function Dashboard() {
  const { data: employees = [], isLoading: loadingEmps } = useEmployees();
  const { data: activePeriod, isLoading: loadingPeriod } = useActivePeriod();
  const createPeriod = useCreatePeriod();
  const { data: records = [] } = usePayrollRecords(activePeriod?.id);

  // Auto-create period if none exists
  useEffect(() => {
    if (!loadingPeriod && !activePeriod && !createPeriod.isPending) {
      createPeriod.mutate(getCurrentPeriodDates());
    }
  }, [loadingPeriod, activePeriod]);

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

  if (loadingEmps) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>
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
