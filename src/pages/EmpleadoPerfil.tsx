import { useParams, useNavigate } from "react-router-dom";
import { useEmployees, useUpdateEmployee, useActivePeriod, usePayrollRecords, useCreatePeriod, getCurrentPeriodDates, recordToConfig } from "@/hooks/useSupabasePayroll";
import { ClientCampaignPicker } from "@/components/ClientCampaignPicker";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { calcularNomina, type Turno } from "@/types/payroll";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "MXN" });

export default function EmpleadoPerfil() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: employees = [], isLoading } = useEmployees();
  const updateEmployee = useUpdateEmployee();
  const { data: activePeriod } = useActivePeriod();
  const createPeriod = useCreatePeriod();
  const { data: records = [] } = usePayrollRecords(activePeriod?.id);
  const queryClient = useQueryClient();
  const { isLeadership } = useAuth();

  // Cascading Client → Campaign state
  const empRecord = employees.find((e) => e.id === id);
  const campaignId = (empRecord as any)?._campaignId ?? null;
  // Find which client this campaign belongs to
  const { data: currentCampaign } = useQuery({
    queryKey: ['emp-campaign', campaignId],
    queryFn: async () => {
      if (!campaignId) return null;
      const { data } = await supabase
        .from('campaigns')
        .select('id, client_id, name')
        .eq('id', campaignId)
        .maybeSingle();
      return data;
    },
    enabled: !!campaignId,
  });
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  useEffect(() => {
    if (currentCampaign?.client_id) setSelectedClientId(currentCampaign.client_id);
  }, [currentCampaign?.client_id]);
  const { data: campaignShifts = [] } = useQuery({
    queryKey: ['shift-options', campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const { data, error } = await supabase
        .from('shift_settings')
        .select('id, shift_name, start_time, end_time, days_of_week')
        .eq('campaign_id', campaignId)
        .order('shift_name');
      if (error) throw error;
      return data as { id: string; shift_name: string; start_time: string; end_time: string; days_of_week: number[] | null }[];
    },
    enabled: !!campaignId,
  });

  // Auto-create period if none exists
  useEffect(() => {
    if (!isLoading && !activePeriod && !createPeriod.isPending) {
      createPeriod.mutate(getCurrentPeriodDates());
    }
  }, [isLoading, activePeriod]);

  const emp = employees.find((e) => e.id === id);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>;
  }

  if (!emp) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">Employee not found</p>
        <Button variant="outline" onClick={() => navigate("/empleados")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
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

  return (
    <div className="space-y-6 max-w-4xl">
      <Button variant="ghost" onClick={() => navigate("/empleados")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Employees
      </Button>

      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-lg">{emp.nombre[0]}</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold">{emp.nombre}</h2>
          <p className="text-muted-foreground">ID: {emp.id} · Shift: {emp.turno}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Assignment Card — visible to Team Lead and above */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Assignment</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <ClientCampaignPicker
              value={{ clientId: selectedClientId || null, campaignId: campaignId || null }}
              onChange={async ({ clientId, campaignId: newCampaignId }) => {
                setSelectedClientId(clientId || "");
                if (newCampaignId !== campaignId) {
                  const { error } = await supabase
                    .from("employees")
                    .update({ campaign_id: newCampaignId })
                    .eq("employee_id", emp.id);
                  if (error) {
                    toast.error(`Failed to assign campaign: ${error.message}`);
                    return;
                  }
                  queryClient.invalidateQueries({ queryKey: ["employees"] });
                  toast.success("Campaign assigned");
                }
              }}
            />
            <div className="grid gap-2">
              <Label>Shift</Label>
              <Select value={emp.turno} onValueChange={(v) => saveField("turno", v as Turno)}>
                <SelectTrigger><SelectValue placeholder="Select a shift..." /></SelectTrigger>
                <SelectContent>
                  {campaignShifts.length > 0 ? (
                    campaignShifts.map((s) => (
                      <SelectItem key={s.id} value={s.shift_name}>
                        {s.shift_name}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}
                        </span>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value={emp.turno || 'none'} disabled>
                      {campaignId ? 'No shifts configured' : 'Assign a campaign first'}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Salary Configuration — leadership only */}
        {isLeadership && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Salary Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Monthly Base Salary</Label>
              <Input type="number" value={emp.sueldoBase || ""} onChange={(e) => saveField("sueldoBase", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="grid gap-2">
              <Label>Daily Absence Discount</Label>
              <Input type="number" value={emp.descuentoPorDia || ""} onChange={(e) => saveField("descuentoPorDia", parseFloat(e.target.value) || 0)} />
            </div>
            <div className="grid gap-2">
              <Label>KPI Bonus Amount</Label>
              <Input type="number" value={emp.kpiMonto || ""} onChange={(e) => saveField("kpiMonto", parseFloat(e.target.value) || 0)} />
            </div>
            <Separator />
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">Daily Salary</p>
              <p className="text-xl font-bold">{fmt(result.sueldoDiario)}</p>
            </div>
          </CardContent>
        </Card>
        )}

      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Biweekly Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <Row label="Biweekly Salary (Base/2)" value={fmt(result.sueldoQuincenal)} />
            <Separator />
            <p className="text-sm font-semibold text-destructive">Deductions</p>
            <Row label={`Absences (${config.diasFaltados} × ${fmt(emp.descuentoPorDia)})`} value={`-${fmt(result.descuentoFaltas)}`} negative />
            <Separator />
            <p className="text-sm font-semibold text-primary">Extras</p>
            <Row label="KPI" value={`+${fmt(result.montoKpi)}`} />
            <Row label={`Extra Days (${config.diasExtra} × $1,000)`} value={`+${fmt(result.montoDiasExtra)}`} />
            <Row label="Sunday Premium" value={`+${fmt(result.montoPrimaDominical)}`} />
            <Row label="Holiday" value={`+${fmt(result.montoDiaFestivo)}`} />
            <Row label="Additional Bonuses" value={`+${fmt(result.bonosAdicionales)}`} />
            <Separator />
            <div className="flex justify-between items-center p-3 rounded-lg bg-primary/10">
              <span className="font-bold text-lg">Net Pay</span>
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
