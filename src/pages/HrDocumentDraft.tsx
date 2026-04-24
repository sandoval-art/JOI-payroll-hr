import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { LogoLoadingIndicator } from "@/components/ui/LogoLoadingIndicator";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ArrowLeft, Save, FileText, Plus, Trash2, AlertTriangle, Unlink, Eye, Upload, ExternalLink, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatDateMX, formatDateMXLong } from "@/lib/localDate";
import {
  COMPANY_LEGAL_NAME,
  COMPANY_LEGAL_ADDRESS,
} from "@/lib/companyInfo";
import {
  useHrDocumentRequest,
  useHrFinalization,
  useCreateHrFinalizationDraft,
  useSaveFinalizationDraft,
  usePriorSignedCartaForEmployee,
  useCartaById,
  useUploadFinalizedPdf,
  useUploadSignedScan,
  type FinalizationDraft,
} from "@/hooks/useHrDocumentRequests";
import type { CartaKpiRow, ActaWitness } from "@/types/hr-docs";
import { generateCartaPdf } from "@/lib/pdf/generateCartaPdf";
import { generateActaPdf } from "@/lib/pdf/generateActaPdf";
import { generateRenunciaPacketPdf } from "@/lib/pdf/generateRenunciaPacketPdf";
import {
  calcAguinaldoProporcional,
  calcVacaciones,
  calcPrimaVacacional,
  calcFiniquitoTotal,
  numberToSpanishWords,
} from "@/lib/lftCalculations";

// ── Snapshot auto-populate helpers ──────────────────────────────────

interface SnapshotSeed {
  trabajadorNameSnapshot: string;
  puestoSnapshot: string;
  horarioSnapshot: string;
  supervisorNameSnapshot: string;
  companyLegalNameSnapshot: string;
  companyLegalAddressSnapshot: string;
  incidentDateLongSnapshot: string;
}

function formatShiftRange(
  startTime: string | null,
  endTime: string | null,
  daysOfWeek: number[] | null,
): string {
  if (!startTime || !endTime) return "";
  const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const fmt = (t: string) => {
    const [h, m] = t.split(":");
    const hr = parseInt(h, 10);
    const ampm = hr >= 12 ? "PM" : "AM";
    const hr12 = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
    return `${hr12}:${m} ${ampm}`;
  };
  const days =
    daysOfWeek && daysOfWeek.length > 0
      ? daysOfWeek.map((d) => DAY_LABELS[d]).join("-")
      : "Lun-Vie";
  return `${days} ${fmt(startTime)} – ${fmt(endTime)}`;
}

// ── Form state shape ────────────────────────────────────────────────

interface DraftFormState {
  narrative: string;
  trabajadorNameSnapshot: string;
  puestoSnapshot: string;
  horarioSnapshot: string;
  supervisorNameSnapshot: string;
  companyLegalNameSnapshot: string;
  companyLegalAddressSnapshot: string;
  incidentDateLongSnapshot: string;
  kpiTable: CartaKpiRow[];
  witnesses: ActaWitness[];
  reincidenciaPriorCartaId: string | null;
  // Renuncia-specific
  effectiveDate: string;
  renunciaNarrative: string;
  hireDateSnapshot: string;
  salarioDiarioSnapshot: string;
  aguinaldoMonto: string;
  vacacionesMonto: string;
  primaVacacionalMonto: string;
  totalMonto: string;
  totalEnLetras: string;
  curpSnapshot: string;
  rfcSnapshot: string;
  claveElector: string;
}

function draftToFormState(draft: FinalizationDraft): DraftFormState {
  return {
    narrative: draft.narrative ?? "",
    trabajadorNameSnapshot: draft.trabajadorNameSnapshot ?? "",
    puestoSnapshot: draft.puestoSnapshot ?? "",
    horarioSnapshot: draft.horarioSnapshot ?? "",
    supervisorNameSnapshot: draft.supervisorNameSnapshot ?? "",
    companyLegalNameSnapshot: draft.companyLegalNameSnapshot ?? "",
    companyLegalAddressSnapshot: draft.companyLegalAddressSnapshot ?? "",
    incidentDateLongSnapshot: draft.incidentDateLongSnapshot ?? "",
    kpiTable: draft.kpiTable ?? [],
    witnesses: draft.witnesses ?? [],
    reincidenciaPriorCartaId: draft.reincidenciaPriorCartaId,
    effectiveDate: draft.effectiveDate ?? "",
    renunciaNarrative: draft.renunciaNarrative ?? "",
    hireDateSnapshot: draft.hireDateSnapshot ?? "",
    salarioDiarioSnapshot: draft.salarioDiarioSnapshot != null ? String(draft.salarioDiarioSnapshot) : "",
    aguinaldoMonto: draft.aguinaldoMonto != null ? String(draft.aguinaldoMonto) : "",
    vacacionesMonto: draft.vacacionesMonto != null ? String(draft.vacacionesMonto) : "",
    primaVacacionalMonto: draft.primaVacacionalMonto != null ? String(draft.primaVacacionalMonto) : "",
    totalMonto: draft.totalMonto != null ? String(draft.totalMonto) : "",
    totalEnLetras: draft.totalEnLetras ?? "",
    curpSnapshot: draft.curpSnapshot ?? "",
    rfcSnapshot: draft.rfcSnapshot ?? "",
    claveElector: draft.claveElector ?? "",
  };
}

function seedToFormState(seed: SnapshotSeed): DraftFormState {
  return {
    narrative: "",
    kpiTable: [],
    witnesses: [],
    reincidenciaPriorCartaId: null,
    effectiveDate: "",
    renunciaNarrative: "",
    hireDateSnapshot: "",
    salarioDiarioSnapshot: "",
    aguinaldoMonto: "",
    vacacionesMonto: "",
    primaVacacionalMonto: "",
    totalMonto: "",
    totalEnLetras: "",
    curpSnapshot: "",
    rfcSnapshot: "",
    claveElector: "",
    ...seed,
  };
}

// ── Main component ──────────────────────────────────────────────────

export default function HrDocumentDraft() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { employeeId: authEmployeeId } = useAuth();

  // Request + existing draft
  const { data: request, isLoading: reqLoading } = useHrDocumentRequest(id);
  const { data: draft, isLoading: draftLoading } = useHrFinalization(
    id,
    request?.requestType,
  );

  // Snapshot seed data (fetched once for auto-populate)
  const [snapshotSeed, setSnapshotSeed] = useState<SnapshotSeed | null>(null);
  const seedFetched = useRef(false);

  useEffect(() => {
    if (!request || seedFetched.current) return;
    seedFetched.current = true;

    (async () => {
      // Fetch employee full_name, department, campaign_id
      const { data: emp } = await supabase
        .from("employees")
        .select(
          "full_name, department_id, campaign_id, departments(name), campaigns!employees_campaign_id_fkey(name, team_lead_id)",
        )
        .eq("id", request.employeeId)
        .single();

      // Fetch shift_settings for campaign
      let horario = "";
      if (emp?.campaign_id) {
        const { data: shifts } = await supabase
          .from("shift_settings")
          .select("start_time, end_time, days_of_week")
          .eq("campaign_id", emp.campaign_id)
          .limit(1)
          .maybeSingle();
        if (shifts) {
          horario = formatShiftRange(
            shifts.start_time,
            shifts.end_time,
            shifts.days_of_week as number[] | null,
          );
        }
      }

      // Fetch TL display name
      let supervisorName = "";
      const tlId = (emp?.campaigns as { team_lead_id?: string } | null)
        ?.team_lead_id;
      if (tlId) {
        const { data: tl } = await supabase
          .from("employees")
          .select("full_name, work_name")
          .eq("id", tlId)
          .single();
        if (tl) {
          supervisorName = tl.work_name?.trim() || tl.full_name;
        }
      }

      setSnapshotSeed({
        trabajadorNameSnapshot: (emp?.full_name ?? "").toUpperCase(),
        puestoSnapshot:
          (emp?.departments as { name?: string } | null)?.name ?? "",
        horarioSnapshot: horario,
        supervisorNameSnapshot: supervisorName,
        companyLegalNameSnapshot: COMPANY_LEGAL_NAME,
        companyLegalAddressSnapshot: COMPANY_LEGAL_ADDRESS,
        incidentDateLongSnapshot: formatDateMXLong(request.incidentDate),
      });
    })();
  }, [request]);

  // Prior signed carta for reincidencia (actas only)
  const { data: priorCarta } = usePriorSignedCartaForEmployee(
    request?.requestType === "acta" ? request?.employeeId : undefined,
  );

  // ── Form state with dirty flag ─────────────────────────────────────
  const [form, setForm] = useState<DraftFormState>({
    narrative: "",
    trabajadorNameSnapshot: "",
    puestoSnapshot: "",
    horarioSnapshot: "",
    supervisorNameSnapshot: "",
    companyLegalNameSnapshot: "",
    companyLegalAddressSnapshot: "",
    incidentDateLongSnapshot: "",
    kpiTable: [],
    witnesses: [],
    reincidenciaPriorCartaId: null,
    effectiveDate: "",
    renunciaNarrative: "",
    hireDateSnapshot: "",
    salarioDiarioSnapshot: "",
    aguinaldoMonto: "",
    vacacionesMonto: "",
    primaVacacionalMonto: "",
    totalMonto: "",
    totalEnLetras: "",
    curpSnapshot: "",
    rfcSnapshot: "",
    claveElector: "",
  });
  const formDirty = useRef(false);

  const setFormDirty = (
    updater: DraftFormState | ((prev: DraftFormState) => DraftFormState),
  ) => {
    formDirty.current = true;
    setForm(updater);
  };

  // Sync from server (draft or seed) — skip if user has unsaved edits
  useEffect(() => {
    if (formDirty.current) return;
    if (draft) {
      const state = draftToFormState(draft);
      // Auto-seed reincidencia if draft has none but a prior carta exists
      if (
        draft.type === "acta" &&
        !state.reincidenciaPriorCartaId &&
        priorCarta
      ) {
        state.reincidenciaPriorCartaId = priorCarta.id;
      }
      setForm(state);
    } else if (snapshotSeed) {
      const state = seedToFormState(snapshotSeed);
      if (priorCarta) {
        state.reincidenciaPriorCartaId = priorCarta.id;
      }
      setForm(state);
    }
  }, [draft, snapshotSeed, priorCarta]);

  // ── Mutations ──────────────────────────────────────────────────────
  const createDraft = useCreateHrFinalizationDraft();
  const saveDraft = useSaveFinalizationDraft();
  const saving = createDraft.isPending || saveDraft.isPending;

  async function handleSave() {
    if (!request || !authEmployeeId) return;

    const fields: Record<string, unknown> = {
      narrative: form.narrative || null,
      trabajador_name_snapshot: form.trabajadorNameSnapshot || null,
      puesto_snapshot: form.puestoSnapshot || null,
      horario_snapshot: form.horarioSnapshot || null,
      supervisor_name_snapshot: form.supervisorNameSnapshot || null,
      company_legal_name_snapshot: form.companyLegalNameSnapshot || null,
      company_legal_address_snapshot:
        form.companyLegalAddressSnapshot || null,
      incident_date_long_snapshot: form.incidentDateLongSnapshot || null,
    };

    if (request.requestType === "carta") {
      fields.kpi_table = form.kpiTable;
    } else if (request.requestType === "acta") {
      fields.witnesses = form.witnesses;
      fields.reincidencia_prior_carta_id =
        form.reincidenciaPriorCartaId || null;
    } else if (request.requestType === "renuncia") {
      fields.effective_date = form.effectiveDate || null;
      fields.renuncia_narrative = form.renunciaNarrative || null;
      fields.hire_date_snapshot = form.hireDateSnapshot || null;
      fields.salario_diario_snapshot = form.salarioDiarioSnapshot ? parseFloat(form.salarioDiarioSnapshot) : null;
      fields.aguinaldo_monto = form.aguinaldoMonto ? parseFloat(form.aguinaldoMonto) : null;
      fields.vacaciones_monto = form.vacacionesMonto ? parseFloat(form.vacacionesMonto) : null;
      fields.prima_vacacional_monto = form.primaVacacionalMonto ? parseFloat(form.primaVacacionalMonto) : null;
      fields.total_monto = form.totalMonto ? parseFloat(form.totalMonto) : null;
      fields.total_en_letras = form.totalEnLetras || null;
      fields.curp_snapshot = form.curpSnapshot || null;
      fields.rfc_snapshot = form.rfcSnapshot || null;
      fields.clave_elector = form.claveElector || null;
    }

    try {
      if (!draft) {
        // First save: create via RPC then update fields
        const result = await createDraft.mutateAsync({
          requestId: request.id,
          createdBy: authEmployeeId,
          employeeId: request.employeeId,
        });
        // Now update the freshly-created row with the form fields
        await saveDraft.mutateAsync({
          draftId: result.id,
          type: result.type as "carta" | "acta",
          fields,
          requestId: request.id,
        });
      } else {
        await saveDraft.mutateAsync({
          draftId: draft.id,
          type: draft.type,
          fields,
          requestId: request.id,
        });
      }
      formDirty.current = false;
      toast.success("Borrador guardado");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  // ── PDF hooks + handlers ───────────────────────────────────────────
  const uploadPdf = useUploadFinalizedPdf();
  // For acta reincidencia: fetch linked carta (may differ from priorCarta after desvincular)
  const { data: linkedCarta } = useCartaById(
    draft?.type === "acta" ? draft?.reincidenciaPriorCartaId : undefined,
  );

  function generatePdfBlob(): Blob | null {
    if (!draft || !request) return null;
    if (request.requestType === "carta") {
      return generateCartaPdf(draft, request);
    }
    if (request.requestType === "renuncia") {
      return generateRenunciaPacketPdf(draft, request);
    }
    return generateActaPdf(
      draft,
      request,
      linkedCarta ?? null,
    );
  }

  function handlePreviewPdf() {
    const blob = generatePdfBlob();
    if (!blob) {
      toast.error("Guarda el borrador primero");
      return;
    }
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  async function handleFinalizePdf() {
    if (!draft || !request) return;
    const blob = generatePdfBlob();
    if (!blob) return;
    try {
      await uploadPdf.mutateAsync({
        draftId: draft.id,
        type: draft.type,
        employeeId: request.employeeId,
        docRef: draft.docRef ?? draft.id,
        pdfBlob: blob,
        requestId: request.id,
      });
      toast.success("PDF guardado");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleViewSavedPdf() {
    if (!draft?.pdfPath) return;
    const { data, error } = await supabase.storage
      .from("hr-documents")
      .createSignedUrl(draft.pdfPath, 3600);
    if (error) {
      toast.error(error.message);
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  // ── Signed-scan upload ─────────────────────────────────────────────
  const uploadScan = useUploadSignedScan();
  const scanInputRef = useRef<HTMLInputElement>(null);
  const MAX_SCAN_SIZE = 10 * 1024 * 1024; // 10 MB

  function handleScanFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (scanInputRef.current) scanInputRef.current.value = "";
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Archivo debe ser PDF");
      return;
    }
    if (file.size > MAX_SCAN_SIZE) {
      toast.error("Archivo debe ser menor a 10MB");
      return;
    }
    if (!draft || !request) return;

    uploadScan.mutate(
      {
        draftId: draft.id,
        type: draft.type,
        employeeId: request.employeeId,
        docRef: draft.docRef ?? draft.id,
        scanBlob: file,
        requestId: request.id,
      },
      {
        onSuccess: () => {
          toast.success(
            draft.signedAt
              ? "Escaneo reemplazado"
              : "Escaneo guardado. Solicitud marcada como completada.",
          );
        },
        onError: (err) => toast.error((err as Error).message),
      },
    );
  }

  async function handleViewSignedScan() {
    if (!draft?.signedScanPath) return;
    const { data, error } = await supabase.storage
      .from("hr-documents")
      .createSignedUrl(draft.signedScanPath, 3600);
    if (error) {
      toast.error(error.message);
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  // ── Loading / not found ────────────────────────────────────────────

  if (reqLoading || draftLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <LogoLoadingIndicator size="lg" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-muted-foreground">Solicitud no encontrada.</p>
        <Button variant="outline" onClick={() => navigate("/hr/document-queue")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Volver a la cola
        </Button>
      </div>
    );
  }

  const isTerminal =
    request.status === "canceled" || request.status === "downgraded";

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/hr/document-queue")}
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Cola
          </Button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {request.requestType === "acta"
              ? "Acta administrativa"
              : request.requestType === "renuncia"
                ? "Paquete de renuncia"
                : "Carta de compromiso"}
          </h1>
          <Badge variant="outline" className="text-xs">
            {draft?.docRef ?? "— (se generará al guardar)"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {draft && (
            <span className="text-xs text-muted-foreground">
              Último guardado: {formatDateMX(draft.updatedAt)}
            </span>
          )}
          {!isTerminal && (
            <>
              <Button onClick={handleSave} disabled={saving} size="sm">
                <Save className="mr-1 h-4 w-4" />
                {saving ? "Guardando..." : "Guardar borrador"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviewPdf}
                disabled={!draft || !form.narrative.trim()}
              >
                <Eye className="mr-1 h-4 w-4" /> Vista previa PDF
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleFinalizePdf}
                disabled={!draft || uploadPdf.isPending}
              >
                <Upload className="mr-1 h-4 w-4" />
                {uploadPdf.isPending ? "Subiendo..." : "Finalizar y guardar PDF"}
              </Button>
            </>
          )}
          {draft?.pdfPath && (
            <Button variant="link" size="sm" onClick={handleViewSavedPdf}>
              <ExternalLink className="mr-1 h-3 w-3" /> Ver PDF guardado
            </Button>
          )}
        </div>
      </div>

      {/* Stale PDF warning */}
      {formDirty.current && draft?.pdfPath && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            Tienes cambios sin guardar. El PDF guardado refleja la versión anterior — regenera después de guardar para actualizarlo.
          </p>
        </div>
      )}

      {isTerminal && (
        <div className="rounded-lg border border-destructive/30 p-3 text-sm bg-destructive/5">
          Esta solicitud fue{" "}
          {request.status === "canceled" ? "cancelada" : "degradada"}.
          {request.canceledReason && (
            <> Razón: {request.canceledReason}</>
          )}
        </div>
      )}

      {/* ── Signed-scan upload section ──────────────────── */}
      {draft && !isTerminal && (
        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Escaneo firmado
          </h3>

          {/* Hidden file input */}
          <input
            ref={scanInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            aria-label="Subir escaneo firmado"
            onChange={handleScanFileSelect}
          />

          {!draft.pdfPath && (
            <p className="text-xs text-muted-foreground">
              Genera y guarda el PDF primero antes de subir el escaneo firmado.
            </p>
          )}

          {draft.pdfPath && !draft.signedAt && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => scanInputRef.current?.click()}
                disabled={uploadScan.isPending}
              >
                <Upload className="mr-1 h-4 w-4" />
                {uploadScan.isPending
                  ? "Subiendo..."
                  : "Subir escaneo firmado"}
              </Button>
              <span className="text-xs text-muted-foreground">
                PDF, máx 10MB
              </span>
            </div>
          )}

          {draft.signedAt && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 rounded-md bg-emerald-50 border border-emerald-200">
                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-sm text-emerald-800">
                  Firmado el {formatDateMX(draft.signedAt)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleViewSignedScan}
                >
                  <ExternalLink className="mr-1 h-3 w-3" /> Ver escaneo
                  firmado
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => scanInputRef.current?.click()}
                  disabled={uploadScan.isPending}
                >
                  <RefreshCw className="mr-1 h-3 w-3" />
                  {uploadScan.isPending
                    ? "Subiendo..."
                    : "Reemplazar escaneo"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Split-view */}
      <ResizablePanelGroup direction="horizontal" className="min-h-[600px] rounded-lg border">
        {/* Left: TL narrative (read-only) */}
        <ResizablePanel defaultSize={40} minSize={25}>
          <div className="h-full overflow-y-auto p-4 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Solicitud del TL
            </h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Agente:</span>{" "}
                <span className="font-medium">
                  {request.employeeName ?? "—"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Campaña:</span>{" "}
                {request.campaignName ?? "—"}
              </div>
              <div>
                <span className="text-muted-foreground">
                  Fecha del incidente:
                </span>{" "}
                {formatDateMX(request.incidentDate)}
              </div>
              <div>
                <span className="text-muted-foreground">Solicitante:</span>{" "}
                {request.filerName ?? "—"}
              </div>
              {request.reason && (
                <div>
                  <span className="text-muted-foreground">Motivo:</span>{" "}
                  <span className="italic">{request.reason}</span>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Narrativa del TL
              </p>
              <div className="rounded-lg border p-3 text-sm whitespace-pre-wrap bg-muted/30">
                {request.tlNarrative}
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right: HR draft form */}
        <ResizablePanel defaultSize={60} minSize={30}>
          <div className="h-full overflow-y-auto p-4 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Redacción formal (HR)
            </h2>

            {/* Snapshot fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="snap-name" className="text-xs">
                  Trabajador (nombre legal)
                </Label>
                <Input
                  id="snap-name"
                  value={form.trabajadorNameSnapshot}
                  onChange={(e) =>
                    setFormDirty((f) => ({
                      ...f,
                      trabajadorNameSnapshot: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="snap-puesto" className="text-xs">
                  Puesto
                </Label>
                <Input
                  id="snap-puesto"
                  value={form.puestoSnapshot}
                  onChange={(e) =>
                    setFormDirty((f) => ({
                      ...f,
                      puestoSnapshot: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="snap-supervisor" className="text-xs">
                  Supervisor
                </Label>
                <Input
                  id="snap-supervisor"
                  value={form.supervisorNameSnapshot}
                  onChange={(e) =>
                    setFormDirty((f) => ({
                      ...f,
                      supervisorNameSnapshot: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="snap-date" className="text-xs">
                  Fecha del incidente (forma larga)
                </Label>
                <Input
                  id="snap-date"
                  value={form.incidentDateLongSnapshot}
                  onChange={(e) =>
                    setFormDirty((f) => ({
                      ...f,
                      incidentDateLongSnapshot: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="snap-horario" className="text-xs">
                Horario
              </Label>
              <Textarea
                id="snap-horario"
                rows={2}
                value={form.horarioSnapshot}
                onChange={(e) =>
                  setFormDirty((f) => ({
                    ...f,
                    horarioSnapshot: e.target.value,
                  }))
                }
                placeholder="Ej: Lun-Vie 9:00 AM – 6:00 PM"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="snap-company" className="text-xs">
                  Razón social
                </Label>
                <Input
                  id="snap-company"
                  value={form.companyLegalNameSnapshot}
                  onChange={(e) =>
                    setFormDirty((f) => ({
                      ...f,
                      companyLegalNameSnapshot: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="snap-address" className="text-xs">
                  Domicilio fiscal
                </Label>
                <Textarea
                  id="snap-address"
                  rows={2}
                  value={form.companyLegalAddressSnapshot}
                  onChange={(e) =>
                    setFormDirty((f) => ({
                      ...f,
                      companyLegalAddressSnapshot: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* Main narrative */}
            <div className="space-y-1">
              <Label htmlFor="narrative" className="text-xs font-medium">
                Narrativa formal (redactada por HR)
              </Label>
              <Textarea
                id="narrative"
                rows={12}
                value={form.narrative}
                onChange={(e) =>
                  setFormDirty((f) => ({
                    ...f,
                    narrative: e.target.value,
                  }))
                }
                placeholder="Redacta la versión formal basándote en la narrativa del TL a la izquierda."
              />
            </div>

            {/* ── KPI table editor (cartas only) ──────────────── */}
            {request.requestType === "carta" && (
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium uppercase tracking-wider">
                    Áreas a mejorar (KPI)
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setFormDirty((f) => ({
                        ...f,
                        kpiTable: [
                          ...f.kpiTable,
                          { area: "", indicador: "", meta: "" },
                        ],
                      }))
                    }
                  >
                    <Plus className="mr-1 h-3 w-3" /> Agregar fila
                  </Button>
                </div>
                {form.kpiTable.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Sin filas de KPI. Agrega una con el botón de arriba.
                  </p>
                )}
                {form.kpiTable.map((row, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end rounded-md border p-2"
                  >
                    <div className="space-y-1">
                      {idx === 0 && (
                        <Label className="text-[10px] text-muted-foreground">
                          Área
                        </Label>
                      )}
                      <Input
                        value={row.area}
                        placeholder="Ej: Asistencia"
                        onChange={(e) =>
                          setFormDirty((f) => {
                            const t = [...f.kpiTable];
                            t[idx] = { ...t[idx], area: e.target.value };
                            return { ...f, kpiTable: t };
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      {idx === 0 && (
                        <Label className="text-[10px] text-muted-foreground">
                          Indicador / KPI
                        </Label>
                      )}
                      <Input
                        value={row.indicador}
                        placeholder="Ej: Puntualidad"
                        onChange={(e) =>
                          setFormDirty((f) => {
                            const t = [...f.kpiTable];
                            t[idx] = {
                              ...t[idx],
                              indicador: e.target.value,
                            };
                            return { ...f, kpiTable: t };
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      {idx === 0 && (
                        <Label className="text-[10px] text-muted-foreground">
                          Meta
                        </Label>
                      )}
                      <Input
                        value={row.meta}
                        placeholder="Ej: 0 retardos"
                        onChange={(e) =>
                          setFormDirty((f) => {
                            const t = [...f.kpiTable];
                            t[idx] = { ...t[idx], meta: e.target.value };
                            return { ...f, kpiTable: t };
                          })
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        setFormDirty((f) => ({
                          ...f,
                          kpiTable: f.kpiTable.filter((_, i) => i !== idx),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* ── Reincidencia banner (actas only) ────────────── */}
            {request.requestType === "acta" && (
              <>
                {form.reincidenciaPriorCartaId && priorCarta && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-sm text-amber-800 flex-1">
                      <span className="font-medium">Reincidencia:</span> esta
                      acta cita la carta previa{" "}
                      <span className="font-mono text-xs">
                        {priorCarta.doc_ref ?? "sin ref"}
                      </span>{" "}
                      de {formatDateMX(priorCarta.created_at)}.
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-amber-700"
                      onClick={() =>
                        setFormDirty((f) => ({
                          ...f,
                          reincidenciaPriorCartaId: null,
                        }))
                      }
                    >
                      <Unlink className="mr-1 h-3 w-3" /> Desvincular
                    </Button>
                  </div>
                )}
                {!form.reincidenciaPriorCartaId &&
                  priorCarta === null && (
                    <p className="text-xs text-muted-foreground italic">
                      No se encontró carta previa firmada para este empleado.
                    </p>
                  )}

                {/* ── Witness editor (actas only) ──────────────── */}
                <div className="space-y-3 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium uppercase tracking-wider">
                      Testigos
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setFormDirty((f) => ({
                          ...f,
                          witnesses: [
                            ...f.witnesses,
                            { name: "", role: "" },
                          ],
                        }))
                      }
                    >
                      <Plus className="mr-1 h-3 w-3" /> Agregar testigo
                    </Button>
                  </div>
                  {form.witnesses.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Sin testigos. Agrega uno con el botón de arriba.
                    </p>
                  )}
                  {form.witnesses.map((w, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end rounded-md border p-2"
                    >
                      <div className="space-y-1">
                        {idx === 0 && (
                          <Label className="text-[10px] text-muted-foreground">
                            Nombre del testigo
                          </Label>
                        )}
                        <Input
                          value={w.name}
                          placeholder="Nombre completo"
                          onChange={(e) =>
                            setFormDirty((f) => {
                              const ws = [...f.witnesses];
                              ws[idx] = { ...ws[idx], name: e.target.value };
                              return { ...f, witnesses: ws };
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        {idx === 0 && (
                          <Label className="text-[10px] text-muted-foreground">
                            Cargo / Relación
                          </Label>
                        )}
                        <Input
                          value={w.role}
                          placeholder="Ej: Compañero de trabajo"
                          onChange={(e) =>
                            setFormDirty((f) => {
                              const ws = [...f.witnesses];
                              ws[idx] = { ...ws[idx], role: e.target.value };
                              return { ...f, witnesses: ws };
                            })
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          setFormDirty((f) => ({
                            ...f,
                            witnesses: f.witnesses.filter(
                              (_, i) => i !== idx,
                            ),
                          }))
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── Renuncia-specific: finiquito calculator ─────── */}
            {request.requestType === "renuncia" && (
              <div className="space-y-4 pt-2 border-t">
                {/* Effective date */}
                <div className="space-y-1">
                  <Label htmlFor="effective-date" className="text-xs font-medium">
                    Fecha efectiva de renuncia
                  </Label>
                  <Input
                    id="effective-date"
                    type="date"
                    value={form.effectiveDate}
                    onChange={(e) =>
                      setFormDirty((f) => ({
                        ...f,
                        effectiveDate: e.target.value,
                      }))
                    }
                  />
                </div>

                {/* Finiquito calculator */}
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium uppercase tracking-wider">
                      Finiquito — cálculo LFT
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const sd = parseFloat(form.salarioDiarioSnapshot);
                        const hd = form.hireDateSnapshot;
                        const rd = form.effectiveDate;
                        if (!sd || !hd || !rd) {
                          toast.error("Ingresa fecha de ingreso, salario diario y fecha efectiva primero");
                          return;
                        }
                        const aguinaldo = calcAguinaldoProporcional({ salarioDiario: sd, hireDate: hd, resignationDate: rd });
                        const vac = calcVacaciones({ salarioDiario: sd, hireDate: hd, resignationDate: rd });
                        const prima = calcPrimaVacacional(vac.amount);
                        const total = calcFiniquitoTotal({ aguinaldo, vacaciones: vac.amount, prima });
                        setFormDirty((f) => ({
                          ...f,
                          aguinaldoMonto: String(aguinaldo),
                          vacacionesMonto: String(vac.amount),
                          primaVacacionalMonto: String(prima),
                          totalMonto: String(total),
                          totalEnLetras: numberToSpanishWords(total),
                        }));
                      }}
                    >
                      Calcular automáticamente
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        Fecha de ingreso
                      </Label>
                      <Input
                        type="date"
                        value={form.hireDateSnapshot}
                        onChange={(e) =>
                          setFormDirty((f) => ({
                            ...f,
                            hireDateSnapshot: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        Salario diario ($ MXN)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.salarioDiarioSnapshot}
                        onChange={(e) =>
                          setFormDirty((f) => ({
                            ...f,
                            salarioDiarioSnapshot: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        Aguinaldo proporcional
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.aguinaldoMonto}
                        onChange={(e) =>
                          setFormDirty((f) => ({
                            ...f,
                            aguinaldoMonto: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        Vacaciones correspondientes
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.vacacionesMonto}
                        onChange={(e) =>
                          setFormDirty((f) => ({
                            ...f,
                            vacacionesMonto: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        Prima vacacional (25%)
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.primaVacacionalMonto}
                        onChange={(e) =>
                          setFormDirty((f) => ({
                            ...f,
                            primaVacacionalMonto: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground font-medium">
                        Total
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.totalMonto}
                        onChange={(e) =>
                          setFormDirty((f) => ({
                            ...f,
                            totalMonto: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">
                      Total en letras
                    </Label>
                    <Textarea
                      rows={2}
                      value={form.totalEnLetras}
                      onChange={(e) =>
                        setFormDirty((f) => ({
                          ...f,
                          totalEnLetras: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                {/* Identity snapshots */}
                <div className="space-y-3 rounded-lg border p-3">
                  <Label className="text-xs font-medium uppercase tracking-wider">
                    Datos de identidad
                  </Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        CURP
                      </Label>
                      <Input
                        value={form.curpSnapshot}
                        readOnly
                        className="bg-muted/30"
                      />
                      {!form.curpSnapshot && (
                        <p className="text-[10px] text-amber-600">
                          — (faltante)
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        RFC
                      </Label>
                      <Input
                        value={form.rfcSnapshot}
                        readOnly
                        className="bg-muted/30"
                      />
                      {!form.rfcSnapshot && (
                        <p className="text-[10px] text-amber-600">
                          — (faltante)
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        Clave de Elector
                      </Label>
                      <Input
                        value={form.claveElector}
                        onChange={(e) =>
                          setFormDirty((f) => ({
                            ...f,
                            claveElector: e.target.value,
                          }))
                        }
                        placeholder="Ingresa clave de elector"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
