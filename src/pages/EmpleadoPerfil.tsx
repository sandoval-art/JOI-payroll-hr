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
import { ArrowLeft, Save, Upload, Check, X, Eye, RefreshCw, ShieldCheck, ShieldAlert, ShieldX, CalendarClock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState, useRef } from "react";
import { useComplianceStatus } from "@/hooks/useComplianceStatus";
import { useQueryClient } from "@tanstack/react-query";
import {
  useEmployeeDocuments,
  useUploadDocument,
  useReviewDocument,
  getDocumentSignedUrl,
} from "@/hooks/useEmployeeDocuments";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { ACCEPTED_DOCUMENT_TYPES, ACCEPTED_DOCUMENT_EXTENSIONS, MAX_DOCUMENT_SIZE_BYTES } from "@/lib/documentUpload";

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
  const { isLeadership } = useAuth();

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
      <Button variant="ghost" onClick={() => navigate("/empleados")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Employees
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

        {/* A1: Personal & Tax Info */}
        <Card>
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

      {/* A3a: Compliance Enforcement — leadership only */}
      {isLeadership && (
        <ComplianceCard
          employeeId={emp.id}
          compliance={compliance}
          graceRaw={emp._complianceGraceUntil ?? null}
          updateEmployee={updateEmployee}
        />
      )}

      {/* A2b: Required Documents — leadership only */}
      {isLeadership && <RequiredDocumentsCard employeeId={emp._uuid} />}

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

function RequiredDocumentsCard({ employeeId }: { employeeId: string }) {
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

              {/* File info when doc exists */}
              {doc && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="truncate max-w-[200px]">{doc.file_name}</span>
                  <span>·</span>
                  <span>{new Date(doc.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => handleView(doc.file_path)}>
                    <Eye className="mr-1 h-3 w-3" /> View
                  </Button>
                </div>
              )}

              {/* Rejection reason */}
              {doc?.status === "rejected" && doc.rejection_reason && (
                <p className="text-xs text-destructive">Reason: {doc.rejection_reason}</p>
              )}

              {/* Actions */}
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
