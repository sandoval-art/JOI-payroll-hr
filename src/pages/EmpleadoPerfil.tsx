import { useParams, useNavigate } from "react-router-dom";
import { useEmployees, useUpdateEmployee, useActivePeriod, usePayrollRecords, useCreatePeriod, getCurrentPeriodDates, recordToConfig } from "@/hooks/useSupabasePayroll";
import { ClientCampaignPicker } from "@/components/ClientCampaignPicker";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { calcularNomina } from "@/types/payroll";
import type { EmployeeWithMeta } from "@/types/payroll";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Upload, Check, X, Eye, EyeOff, RefreshCw, ShieldCheck, ShieldAlert, ShieldX, CalendarClock, Trash2, Plus, FileWarning, StickyNote, AlertTriangle, Pencil, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useEffect, useState, useRef } from "react";
import { useComplianceStatus } from "@/hooks/useComplianceStatus";
import { useQueryClient } from "@tanstack/react-query";
import { useAgentLogEntries, useCreateAgentLogEntry, useToggleEntryVisibility, type AgentLogEntry } from "@/hooks/useAgentLog";
import {
  useEmployeeDocuments,
  useUploadDocument,
  useReviewDocument,
  getDocumentSignedUrl,
} from "@/hooks/useEmployeeDocuments";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { ACCEPTED_DOCUMENT_TYPES, ACCEPTED_DOCUMENT_EXTENSIONS, MAX_DOCUMENT_SIZE_BYTES } from "@/lib/documentUpload";
import {
  useAgentIncidents,
  useCreateIncident,
  useUpdateIncident,
  getIncidentDocSignedUrl,
  INCIDENT_TYPE_LABELS,
  type IncidentType,
  type AttendanceIncident,
} from "@/hooks/useAttendanceIncidents";

// ── A1: Personal & Tax Info validation ──────────────────────────────
const CURP_RE = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;
const RFC_RE = /^[A-Z&Ñ]{4}\d{6}[A-Z0-9]{3}$/;
const CLABE_RE = /^\d{18}$/;
const PHONE_RE = /^\d{10}$/;

function validateTaxFields(fields: { curp: string; rfc: string; phone: string; bank_clabe: string }) {
  const errors: Record<string, string> = {};
  if (fields.curp && !CURP_RE.test(fields.curp)) errors.curp = "CURP must be 18 characters (e.g. GARC850101HDFRRL09)";
  if (fields.rfc && !RFC_RE.test(fields.rfc)) errors.rfc = "RFC must be 13 characters (e.g. GARC850101AB3)";
  if (fields.bank_clabe && !CLABE_RE.test(fields.bank_clabe)) errors.bank_clabe = "CLABE must be exactly 18 digits";
  if (fields.phone) {
    const digits = fields.phone.replace(/[\s-]/g, "");
    if (!PHONE_RE.test(digits)) errors.phone = "Phone must be 10 digits";
  }
  return errors;
}

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
  const { isLeadership, isTeamLead, employeeId: authEmployeeId } = useAuth();

  // A3a: compliance status for this employee (uses DB uuid)
  const empRecord = employees.find((e) => e.id === id);
  const empUuid = empRecord?._uuid ?? null;
  const compliance = useComplianceStatus(empUuid);

  // Cascading Client → Campaign state
  const campaignId = empRecord?._campaignId ?? null;

  // Supervisor (auto-derived from campaign TL)
  const supervisorId = empRecord?.reportsTo ?? null;
  const { data: supervisor } = useQuery({
    queryKey: ['supervisor', supervisorId],
    queryFn: async () => {
      if (!supervisorId) return null;
      const { data } = await supabase.from('employees').select('full_name').eq('id', supervisorId).maybeSingle();
      return data;
    },
    enabled: !!supervisorId,
  });
  const supervisorName = supervisor?.full_name ?? null;
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

  // ── A1: Personal & Tax Info state (must be above early returns) ──
  const [taxForm, setTaxForm] = useState({
    curp: "",
    rfc: "",
    address: "",
    phone: "",
    bank_clabe: "",
  });
  const [taxErrors, setTaxErrors] = useState<Record<string, string>>({});

  // Sync when emp data loads/changes
  const empCurp = emp?._curp ?? "";
  const empRfc = emp?._rfc ?? "";
  const empAddress = emp?._address ?? "";
  const empPhone = emp?._phone ?? "";
  const empBankClabe = emp?._bankClabe ?? "";

  useEffect(() => {
    setTaxForm({
      curp: empCurp || "",
      rfc: empRfc || "",
      address: empAddress || "",
      phone: empPhone || "",
      bank_clabe: empBankClabe || "",
    });
  }, [empCurp, empRfc, empAddress, empPhone, empBankClabe]);

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

  const currentRecord = records.find((r) => r.employee_id === emp._uuid);
  const config = recordToConfig(currentRecord, emp.id);
  const result = calcularNomina(emp, config);

  const saveField = (field: string, value: unknown) => {
    updateEmployee.mutate(
      { employeeId: emp.id, data: { [field]: value } },
      { onSuccess: () => toast.success("Dato guardado") }
    );
  };

  const saveTaxFields = () => {
    const normalized = { ...taxForm, phone: taxForm.phone.replace(/[\s-]/g, "") };
    const errors = validateTaxFields(normalized);
    setTaxErrors(errors);
    if (Object.keys(errors).length > 0) return;

    updateEmployee.mutate(
      { employeeId: emp.id, data: normalized },
      {
        onSuccess: () => {
          toast.success("Personal info saved");
          queryClient.invalidateQueries({ queryKey: ["employees"] });
        },
      }
    );
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <Button variant="ghost" onClick={() => navigate(isLeadership ? "/empleados" : "/asistencia")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> {isLeadership ? "Back to Employees" : "Back to Attendance"}
      </Button>

      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-lg">{emp.nombre[0]}</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold">{emp.nombre}</h2>
          <p className="text-muted-foreground">ID: {emp.id}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Assignment Card — visible to Team Lead and above */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Assignment</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {isLeadership ? (
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
            ) : (
              <div className="grid gap-1.5">
                <Label className="text-muted-foreground text-xs">Campaign</Label>
                <p className="text-sm">{empRecord?._campaignName || "—"}</p>
              </div>
            )}
            {/* Shift (read-only from campaign settings) */}
            {campaignShifts.length > 0 && (
              <div className="grid gap-1.5">
                <Label>Shift</Label>
                <div className="p-2.5 rounded-md border bg-muted/30 text-sm">
                  {campaignShifts[0].start_time?.slice(0, 5)}–{campaignShifts[0].end_time?.slice(0, 5)}
                  <span className="text-muted-foreground ml-2">
                    ({campaignShifts[0].days_of_week?.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')})
                  </span>
                </div>
              </div>
            )}
            {/* Supervisor (auto-derived from campaign TL) */}
            <div className="grid gap-1.5">
              <Label className="text-muted-foreground text-xs">Supervisor</Label>
              <p className="text-sm">{supervisorName || "—"}</p>
            </div>
          </CardContent>
        </Card>

        {/* A1: Personal & Tax Info — leadership only */}
        {isLeadership && <Card>
          <CardHeader><CardTitle className="text-lg">Personal & Tax Info</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {isLeadership ? (
              <>
                <div className="grid gap-2">
                  <Label>CURP</Label>
                  <Input
                    value={taxForm.curp}
                    onChange={(e) => setTaxForm((f) => ({ ...f, curp: e.target.value.toUpperCase() }))}
                    placeholder="GARC850101HDFRRL09"
                    maxLength={18}
                  />
                  {taxErrors.curp && <p className="text-xs text-destructive">{taxErrors.curp}</p>}
                </div>
                <div className="grid gap-2">
                  <Label>RFC</Label>
                  <Input
                    value={taxForm.rfc}
                    onChange={(e) => setTaxForm((f) => ({ ...f, rfc: e.target.value.toUpperCase() }))}
                    placeholder="GARC850101AB3"
                    maxLength={13}
                  />
                  {taxErrors.rfc && <p className="text-xs text-destructive">{taxErrors.rfc}</p>}
                </div>
                <div className="grid gap-2">
                  <Label>Address</Label>
                  <Input
                    value={taxForm.address}
                    onChange={(e) => setTaxForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="Calle, Colonia, Ciudad, CP"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Phone</Label>
                  <Input
                    value={taxForm.phone}
                    onChange={(e) => setTaxForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="33 1234 5678"
                    maxLength={15}
                  />
                  {taxErrors.phone && <p className="text-xs text-destructive">{taxErrors.phone}</p>}
                </div>
                <div className="grid gap-2">
                  <Label>Bank CLABE</Label>
                  <Input
                    value={taxForm.bank_clabe}
                    onChange={(e) => setTaxForm((f) => ({ ...f, bank_clabe: e.target.value.replace(/\D/g, "") }))}
                    placeholder="012345678901234567"
                    maxLength={18}
                  />
                  {taxErrors.bank_clabe && <p className="text-xs text-destructive">{taxErrors.bank_clabe}</p>}
                </div>
                <Button onClick={saveTaxFields} disabled={updateEmployee.isPending} className="w-full">
                  <Save className="mr-2 h-4 w-4" />
                  {updateEmployee.isPending ? "Saving..." : "Save Personal Info"}
                </Button>
              </>
            ) : (
              <div className="space-y-3">
                <ReadOnlyField label="CURP" value={emp._curp} />
                <ReadOnlyField label="RFC" value={emp._rfc} />
                <ReadOnlyField label="Address" value={emp._address} />
                <ReadOnlyField label="Phone" value={emp._phone} />
                <ReadOnlyField label="Bank CLABE" value={emp._bankClabe} />
              </div>
            )}
          </CardContent>
        </Card>}

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

      {/* A3a: Compliance Enforcement — leadership only */}
      {isLeadership && (
        <ComplianceCard
          employeeId={emp.id}
          compliance={compliance}
          graceRaw={emp._complianceGraceUntil ?? null}
          updateEmployee={updateEmployee}
        />
      )}

      {/* A2b: Required Documents — leadership + TL (read-only for TL) */}
      {(isLeadership || isTeamLead) && <RequiredDocumentsCard employeeId={emp._uuid} readOnly={!isLeadership} />}

      {/* B1: Notes & Verbal Warnings — leadership + TL on own campaign */}
      {(isLeadership || (isTeamLead && campaignId)) && (
        <AgentLogCard
          agentId={emp._uuid!}
          campaignId={campaignId}
          authorEmployeeId={authEmployeeId}
          isLeadership={isLeadership}
        />
      )}

      {/* B4: Attendance Incidents — leadership + TL on own campaign */}
      {(isLeadership || (isTeamLead && campaignId)) && (
        <AttendanceIncidentsCard agentId={emp._uuid!} employeeId={emp._uuid!} />
      )}

      {/* Biweekly Breakdown — leadership only */}
      {isLeadership && (
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
      )}
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

function ReadOnlyField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value || "—"}</span>
    </div>
  );
}

// ── A3a: Compliance Enforcement Card (leadership only) ───────────────

function ComplianceCard({
  employeeId,
  compliance,
  graceRaw,
  updateEmployee,
}: {
  employeeId: string;
  compliance: ReturnType<typeof useComplianceStatus>;
  graceRaw: string | null;
  updateEmployee: ReturnType<typeof useUpdateEmployee>;
}) {
  const [dateValue, setDateValue] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  // Sync local state when prop changes
  useEffect(() => {
    setDateValue(graceRaw ?? "");
  }, [graceRaw]);

  const saveGrace = (value: string | null) => {
    updateEmployee.mutate(
      { employeeId, data: { compliance_grace_until: value } },
      {
        onSuccess: () => {
          toast.success(value ? `Grace deadline set to ${value}` : "Enforcement cleared");
          setShowPicker(false);
        },
      }
    );
  };

  // Status display
  let statusIcon: React.ReactNode;
  let statusLabel: string;
  let statusColor: string;
  if (compliance.isCompliant) {
    statusIcon = <ShieldCheck className="h-5 w-5 text-emerald-600" />;
    statusLabel = "Compliant";
    statusColor = "text-emerald-700";
  } else if (compliance.isLocked) {
    const lockedSince = graceRaw
      ? new Date(graceRaw + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "—";
    statusIcon = <ShieldX className="h-5 w-5 text-red-600" />;
    statusLabel = `Locked since ${lockedSince}`;
    statusColor = "text-red-700";
  } else if (compliance.isInGrace) {
    const graceDate = compliance.graceUntil?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) ?? "";
    statusIcon = <ShieldAlert className="h-5 w-5 text-amber-600" />;
    statusLabel = `In grace until ${graceDate}`;
    statusColor = "text-amber-700";
  } else {
    statusIcon = <ShieldCheck className="h-5 w-5 text-muted-foreground" />;
    statusLabel = "No enforcement set";
    statusColor = "text-muted-foreground";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <CalendarClock className="h-5 w-5" />
          Compliance Enforcement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status display */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          {statusIcon}
          <div>
            <p className={`font-medium text-sm ${statusColor}`}>{statusLabel}</p>
            {compliance.missingTypes.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {compliance.missingTypes.length} missing required doc{compliance.missingTypes.length > 1 ? "s" : ""}:{" "}
                {compliance.missingTypes.map((t) => t.name).join(", ")}
              </p>
            )}
          </div>
        </div>

        {/* Grace date controls */}
        {showPicker ? (
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label>Grace deadline</Label>
              <Input
                type="date"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  if (!dateValue) {
                    toast.error("Pick a date first");
                    return;
                  }
                  saveGrace(dateValue);
                }}
                disabled={updateEmployee.isPending}
              >
                <Save className="mr-1 h-3 w-3" />
                {updateEmployee.isPending ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowPicker(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDateValue(graceRaw ?? "");
                setShowPicker(true);
              }}
            >
              <CalendarClock className="mr-1 h-3 w-3" />
              {graceRaw ? "Extend grace" : "Set grace deadline"}
            </Button>
            {graceRaw && (
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={() => saveGrace(null)}
                disabled={updateEmployee.isPending}
              >
                <Trash2 className="mr-1 h-3 w-3" />
                Clear enforcement
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── A2b: Required Documents Card (leadership only) ──────────────────

function RequiredDocumentsCard({ employeeId, readOnly = false }: { employeeId: string; readOnly?: boolean }) {
  const { data: rows = [], isLoading } = useEmployeeDocuments(employeeId);
  const uploadDoc = useUploadDocument();
  const reviewDoc = useReviewDocument();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: string; employeeId: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so same file can be re-selected
    if (!file || !uploadTarget) return;

    if (!ACCEPTED_DOCUMENT_TYPES.includes(file.type)) {
      toast.error("Unsupported file type. Please upload PDF, JPG, or PNG.");
      return;
    }
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      toast.error("File too large. Maximum size is 10 MB.");
      return;
    }

    uploadDoc.mutate(
      { employeeId, documentTypeId: uploadTarget, file },
      {
        onSuccess: () => {
          toast.success("Document uploaded");
          setUploadTarget(null);
        },
        onError: (err) => toast.error(`Upload failed: ${(err as Error).message}`),
      }
    );
  };

  const triggerUpload = (typeId: string) => {
    setUploadTarget(typeId);
    fileInputRef.current?.click();
  };

  const handleApprove = (docId: string) => {
    reviewDoc.mutate(
      { documentId: docId, employeeId, status: "approved" },
      {
        onSuccess: () => toast.success("Document approved"),
        onError: (err) => toast.error(`Approval failed: ${(err as Error).message}`),
      }
    );
  };

  const handleReject = () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      toast.error("Please provide a rejection reason.");
      return;
    }
    reviewDoc.mutate(
      { documentId: rejectTarget.id, employeeId: rejectTarget.employeeId, status: "rejected", rejectionReason: rejectReason.trim() },
      {
        onSuccess: () => {
          toast.success("Document rejected");
          setRejectTarget(null);
          setRejectReason("");
        },
        onError: (err) => toast.error(`Rejection failed: ${(err as Error).message}`),
      }
    );
  };

  const handleView = async (filePath: string) => {
    try {
      const url = await getDocumentSignedUrl(filePath);
      window.open(url, "_blank");
    } catch {
      toast.error("Failed to generate view link");
    }
  };

  if (isLoading) return null;
  if (rows.length === 0) return null;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_DOCUMENT_EXTENSIONS}
        className="hidden"
        aria-label="Upload employee document"
        onChange={handleFileSelect}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Required Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.map(({ type, document: doc }) => (
            <div key={type.id} className="flex flex-col gap-2 rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{type.name}</p>
                  {type.description && (
                    <p className="text-xs text-muted-foreground">{type.description}</p>
                  )}
                </div>
                <DocumentStatusBadge document={doc} />
              </div>

              {/* File info when doc exists — hidden in read-only (TL) mode */}
              {!readOnly && doc && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="truncate max-w-[200px]">{doc.file_name}</span>
                  <span>·</span>
                  <span>{new Date(doc.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => handleView(doc.file_path)}>
                    <Eye className="mr-1 h-3 w-3" /> View
                  </Button>
                </div>
              )}

              {/* Rejection reason — hidden in read-only (TL) mode */}
              {!readOnly && doc?.status === "rejected" && doc.rejection_reason && (
                <p className="text-xs text-destructive">Reason: {doc.rejection_reason}</p>
              )}

              {/* Actions — hidden in read-only mode */}
              {!readOnly && (
              <div className="flex gap-2 mt-1">
                {!doc && (
                  <Button size="sm" variant="outline" onClick={() => triggerUpload(type.id)} disabled={uploadDoc.isPending}>
                    <Upload className="mr-1 h-3 w-3" /> Upload
                  </Button>
                )}
                {doc?.status === "pending_review" && (
                  <>
                    <Button size="sm" variant="outline" className="text-emerald-700" onClick={() => handleApprove(doc.id)} disabled={reviewDoc.isPending}>
                      <Check className="mr-1 h-3 w-3" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => setRejectTarget({ id: doc.id, employeeId })} disabled={reviewDoc.isPending}>
                      <X className="mr-1 h-3 w-3" /> Reject
                    </Button>
                  </>
                )}
                {doc?.status === "approved" && (
                  <Button size="sm" variant="outline" onClick={() => triggerUpload(type.id)} disabled={uploadDoc.isPending}>
                    <RefreshCw className="mr-1 h-3 w-3" /> Replace
                  </Button>
                )}
                {doc?.status === "rejected" && (
                  <Button size="sm" variant="outline" onClick={() => triggerUpload(type.id)} disabled={uploadDoc.isPending}>
                    <Upload className="mr-1 h-3 w-3" /> Re-upload
                  </Button>
                )}
              </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Rejection reason dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="reject-reason">Reason for rejection</Label>
            <Textarea
              id="reject-reason"
              autoFocus
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this document was rejected..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={reviewDoc.isPending}>
              {reviewDoc.isPending ? "Rejecting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── B1: Notes & Verbal Warnings Card ──────────────────────────────────

function AgentLogCard({
  agentId,
  campaignId,
  authorEmployeeId,
  isLeadership,
}: {
  agentId: string;
  campaignId: string | null;
  authorEmployeeId: string | null;
  isLeadership: boolean;
}) {
  const { data: entries = [], isLoading } = useAgentLogEntries(agentId);
  const createEntry = useCreateAgentLogEntry();
  const toggleVisibility = useToggleEntryVisibility();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [entryType, setEntryType] = useState<"note" | "verbal_warning">("note");
  const [noteText, setNoteText] = useState("");
  const [shareWithAgent, setShareWithAgent] = useState(false);

  const warningCount = entries.filter((e) => e.entry_type === "verbal_warning").length;
  const canCreate = !!campaignId && !!authorEmployeeId;

  const handleCreate = () => {
    if (!campaignId || !authorEmployeeId || !noteText.trim()) return;
    createEntry.mutate(
      {
        agentId,
        entryType,
        note: noteText.trim(),
        campaignId,
        authorId: authorEmployeeId,
        visibleToAgent: isLeadership ? shareWithAgent : false,
      },
      {
        onSuccess: () => {
          toast.success(entryType === "verbal_warning" ? "Verbal warning recorded" : "Note added");
          setDialogOpen(false);
          setNoteText("");
          setEntryType("note");
          setShareWithAgent(false);
        },
        onError: (err) => toast.error((err as Error).message),
      }
    );
  };

  const handleToggleVisibility = (entry: AgentLogEntry) => {
    toggleVisibility.mutate(
      { id: entry.id, agentId, visibleToAgent: !entry.visible_to_agent },
      {
        onSuccess: () => toast.success(entry.visible_to_agent ? "Hidden from agent" : "Shared with agent"),
        onError: (err) => toast.error((err as Error).message),
      }
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <StickyNote className="h-5 w-5" />
              Notes & Verbal Warnings
            </CardTitle>
            {canCreate && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEntryType("note");
                  setNoteText("");
                  setShareWithAgent(false);
                  setDialogOpen(true);
                }}
              >
                <Plus className="mr-1 h-3 w-3" /> Add entry
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {warningCount > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-medium text-amber-800">
                {warningCount} verbal warning{warningCount !== 1 ? "s" : ""} on record
              </p>
            </div>
          )}

          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!isLoading && entries.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No entries yet.</p>
          )}

          {entries.length > 0 && (
            <ul className="space-y-3">
              {entries.map((entry) => (
                <li key={entry.id} className="border-l-2 border-muted pl-3 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {entry.entry_type === "verbal_warning" ? (
                      <Badge variant="destructive" className="text-xs"><FileWarning className="mr-1 h-3 w-3" />Verbal Warning</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs"><StickyNote className="mr-1 h-3 w-3" />Note</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      — {entry.author?.full_name ?? "Unknown"}
                    </span>
                    {entry.visible_to_agent ? (
                      <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700"><Eye className="mr-1 h-3 w-3" />Visible to agent</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs bg-muted text-muted-foreground"><EyeOff className="mr-1 h-3 w-3" />Internal</Badge>
                    )}
                  </div>
                  <p className="text-sm">{entry.note}</p>
                  {isLeadership && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => handleToggleVisibility(entry)}
                      disabled={toggleVisibility.isPending}
                    >
                      {entry.visible_to_agent ? "Hide from agent" : "Share with agent"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Add entry dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Log Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="entry-type"
                    checked={entryType === "note"}
                    onChange={() => setEntryType("note")}
                    className="accent-primary"
                  />
                  <span className="text-sm">Note</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="entry-type"
                    checked={entryType === "verbal_warning"}
                    onChange={() => setEntryType("verbal_warning")}
                    className="accent-primary"
                  />
                  <span className="text-sm">Verbal Warning</span>
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-note">Details</Label>
              <Textarea
                id="entry-note"
                autoFocus
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Describe the note or warning..."
                rows={4}
              />
            </div>
            {isLeadership && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shareWithAgent}
                  onChange={(e) => setShareWithAgent(e.target.checked)}
                  className="accent-primary"
                />
                <span className="text-sm">Share with agent</span>
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createEntry.isPending || !noteText.trim()}>
              {createEntry.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── B4: Attendance Incidents Card ─────────────────────────────────────

const INCIDENT_COLORS: Record<IncidentType, string> = {
  no_call_no_show: "bg-red-100 text-red-800 border-red-200",
  late: "bg-amber-100 text-amber-800 border-amber-200",
  sick: "bg-amber-100 text-amber-800 border-amber-200",
  medical_leave: "bg-amber-100 text-amber-800 border-amber-200",
  personal: "bg-blue-100 text-blue-800 border-blue-200",
  bereavement: "bg-blue-100 text-blue-800 border-blue-200",
  other: "bg-gray-100 text-gray-800 border-gray-200",
};

const INCIDENT_TYPES: IncidentType[] = ["late", "sick", "no_call_no_show", "medical_leave", "personal", "bereavement", "other"];

function AttendanceIncidentsCard({ agentId, employeeId }: { agentId: string; employeeId: string }) {
  const { data: incidents = [], isLoading } = useAgentIncidents(agentId);
  const createIncident = useCreateIncident();
  const updateIncident = useUpdateIncident();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AttendanceIncident | null>(null);
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formType, setFormType] = useState<IncidentType>("late");
  const [formNotes, setFormNotes] = useState("");
  const [formFile, setFormFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const openCreate = () => {
    setEditTarget(null);
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormType("late");
    setFormNotes("");
    setFormFile(null);
    setDialogOpen(true);
  };

  const openEdit = (incident: AttendanceIncident) => {
    setEditTarget(incident);
    setFormDate(incident.date);
    setFormType(incident.incident_type);
    setFormNotes(incident.notes || "");
    setFormFile(null);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editTarget) {
      updateIncident.mutate(
        {
          id: editTarget.id,
          employeeId,
          incidentType: formType,
          notes: formNotes || null,
          file: formFile || undefined,
        },
        {
          onSuccess: () => {
            toast.success("Incident updated");
            setDialogOpen(false);
          },
          onError: (err) => toast.error((err as Error).message),
        }
      );
    } else {
      createIncident.mutate(
        {
          employeeId,
          date: formDate,
          incidentType: formType,
          notes: formNotes || undefined,
          file: formFile || undefined,
        },
        {
          onSuccess: () => {
            toast.success("Incident logged");
            setDialogOpen(false);
          },
          onError: (err) => toast.error((err as Error).message),
        }
      );
    }
  };

  const handleViewDoc = async (filePath: string) => {
    try {
      const url = await getIncidentDocSignedUrl(filePath);
      window.open(url, "_blank");
    } catch {
      toast.error("Failed to generate view link");
    }
  };

  const isSaving = createIncident.isPending || updateIncident.isPending;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Attendance Incidents
            </CardTitle>
            <Button size="sm" variant="outline" onClick={openCreate}>
              <Plus className="mr-1 h-3 w-3" /> Log incident
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!isLoading && incidents.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No attendance incidents on record.</p>
          )}
          {incidents.map((incident) => (
            <div key={incident.id} className="flex items-start justify-between gap-3 border-l-2 border-muted pl-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`text-xs ${INCIDENT_COLORS[incident.incident_type]}`}>
                    {INCIDENT_TYPE_LABELS[incident.incident_type]}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(incident.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  {incident.creator?.full_name && (
                    <span className="text-xs text-muted-foreground">— {incident.creator.full_name}</span>
                  )}
                </div>
                {incident.notes && <p className="text-sm">{incident.notes}</p>}
                {incident.supporting_doc_path && (
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => handleViewDoc(incident.supporting_doc_path!)}>
                    <Eye className="mr-1 h-3 w-3" /> View document
                  </Button>
                )}
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => openEdit(incident)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Log / Edit incident dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Incident" : "Log Incident"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="incident-date">Date</Label>
              <Input
                id="incident-date"
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                disabled={!!editTarget}
                max={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="grid gap-2">
              <Label>Type</Label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as IncidentType)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {INCIDENT_TYPES.map((t) => (
                  <option key={t} value={t}>{INCIDENT_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="incident-notes">Notes</Label>
              <Textarea
                id="incident-notes"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Context or details..."
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label>Supporting document (optional)</Label>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPTED_DOCUMENT_EXTENSIONS}
                className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
                onChange={(e) => setFormFile(e.target.files?.[0] || null)}
              />
              {editTarget?.supporting_doc_path && !formFile && (
                <p className="text-xs text-muted-foreground">Existing document attached. Upload a new file to replace.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving || !formDate}>
              {isSaving ? "Saving..." : editTarget ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
