import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ArrowLeft, Save, FileText } from "lucide-react";
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
  type FinalizationDraft,
} from "@/hooks/useHrDocumentRequests";

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
  };
}

function seedToFormState(seed: SnapshotSeed): DraftFormState {
  return {
    narrative: "",
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
      setForm(draftToFormState(draft));
    } else if (snapshotSeed) {
      setForm(seedToFormState(snapshotSeed));
    }
  }, [draft, snapshotSeed]);

  // ── Mutations ──────────────────────────────────────────────────────
  const createDraft = useCreateHrFinalizationDraft();
  const saveDraft = useSaveFinalizationDraft();
  const saving = createDraft.isPending || saveDraft.isPending;

  async function handleSave() {
    if (!request || !authEmployeeId) return;

    const fields = {
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

  // ── Loading / not found ────────────────────────────────────────────

  if (reqLoading || draftLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
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
            <Button onClick={handleSave} disabled={saving} size="sm">
              <Save className="mr-1 h-4 w-4" />
              {saving ? "Guardando..." : "Guardar borrador"}
            </Button>
          )}
        </div>
      </div>

      {isTerminal && (
        <div className="rounded-lg border border-destructive/30 p-3 text-sm bg-destructive/5">
          Esta solicitud fue{" "}
          {request.status === "canceled" ? "cancelada" : "degradada"}.
          {request.canceledReason && (
            <> Razón: {request.canceledReason}</>
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
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
