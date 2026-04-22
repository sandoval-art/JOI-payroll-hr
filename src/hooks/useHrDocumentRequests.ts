import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  HrDocumentRequest,
  HrDocumentRequestType,
  HrDocumentRequestStatus,
  CartaKpiRow,
  ActaWitness,
} from "@/types/hr-docs";

const QUERY_KEY = "hr_document_requests";

export interface HrDocumentRequestRow {
  id: string;
  employee_id: string;
  request_type: string;
  status: string;
  filed_by: string;
  filed_at: string;
  incident_date: string;
  tl_narrative: string;
  reason: string | null;
  fulfilled_carta_id: string | null;
  fulfilled_acta_id: string | null;
  canceled_reason: string | null;
  created_at: string;
  updated_at: string;
  filer?: { full_name: string; work_name: string | null } | null;
}

function mapRow(row: HrDocumentRequestRow): HrDocumentRequest & {
  filerName: string | null;
} {
  return {
    id: row.id,
    employeeId: row.employee_id,
    requestType: row.request_type as HrDocumentRequestType,
    status: row.status as HrDocumentRequest["status"],
    filedBy: row.filed_by,
    filedAt: row.filed_at,
    incidentDate: row.incident_date,
    tlNarrative: row.tl_narrative,
    reason: row.reason,
    fulfilledCartaId: row.fulfilled_carta_id,
    fulfilledActaId: row.fulfilled_acta_id,
    canceledReason: row.canceled_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    filerName: row.filer
      ? (row.filer.work_name?.trim() || row.filer.full_name)
      : null,
  };
}

export type HrDocumentRequestMapped = ReturnType<typeof mapRow>;

/**
 * All hr_document_requests for a given employee, ordered by filed_at DESC.
 * RLS gates access: leadership sees all, TL sees own team, agents see nothing.
 */
export function useHrDocumentRequestsForEmployee(
  employeeId: string | undefined,
) {
  return useQuery({
    queryKey: [QUERY_KEY, "by_employee", employeeId],
    queryFn: async (): Promise<HrDocumentRequestMapped[]> => {
      const { data, error } = await supabase
        .from("hr_document_requests")
        .select("*, filer:filed_by(full_name, work_name)")
        .eq("employee_id", employeeId!)
        .order("filed_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((r) => mapRow(r as unknown as HrDocumentRequestRow));
    },
    enabled: !!employeeId,
  });
}

/**
 * Insert a new hr_document_request with status='pending'.
 * filed_by is set by the caller (must equal my_employee_id() per RLS).
 */
export function useCreateHrDocumentRequest() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      employeeId,
      requestType,
      incidentDate,
      tlNarrative,
      reason,
      filedBy,
    }: {
      employeeId: string;
      requestType: HrDocumentRequestType;
      incidentDate: string;
      tlNarrative: string;
      reason: string | null;
      filedBy: string;
    }) => {
      const { data, error } = await supabase
        .from("hr_document_requests")
        .insert({
          employee_id: employeeId,
          request_type: requestType,
          filed_by: filedBy,
          incident_date: incidentDate,
          tl_narrative: tlNarrative,
          reason: reason || null,
        })
        .select("*, filer:filed_by(full_name, work_name)")
        .single();

      if (error) throw error;
      return mapRow(data as unknown as HrDocumentRequestRow);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: [QUERY_KEY, "by_employee", vars.employeeId],
      });
    },
  });
}

// ── Phase 3: Queue hooks ─────────────────────────────────────────────

export interface HrDocumentRequestQueueRow extends HrDocumentRequestRow {
  employee?: {
    full_name: string;
    work_name: string | null;
    campaign_id: string | null;
    campaigns: { name: string } | null;
  } | null;
}

export type HrDocumentRequestQueueItem = HrDocumentRequestMapped & {
  employeeName: string | null;
  campaignName: string | null;
};

function mapQueueRow(row: HrDocumentRequestQueueRow): HrDocumentRequestQueueItem {
  const base = mapRow(row);
  return {
    ...base,
    employeeName: row.employee
      ? (row.employee.work_name?.trim() || row.employee.full_name)
      : null,
    campaignName: row.employee?.campaigns?.name ?? null,
  };
}

/**
 * HR queue: all requests visible to the caller, optionally filtered by status.
 * Default filter: 'pending'. Pass 'all' to see everything.
 */
export function useHrDocumentRequestsQueue(
  options?: { status?: HrDocumentRequestStatus | "all" },
) {
  const status = options?.status ?? "pending";
  return useQuery({
    queryKey: [QUERY_KEY, "queue", status],
    queryFn: async (): Promise<HrDocumentRequestQueueItem[]> => {
      let query = supabase
        .from("hr_document_requests")
        .select(
          "*, filer:filed_by(full_name, work_name), employee:employee_id!hr_document_requests_employee_id_fkey(full_name, work_name, campaign_id, campaigns!employees_campaign_id_fkey(name))",
        )
        .order("filed_at", { ascending: false });

      if (status !== "all") {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((r) =>
        mapQueueRow(r as unknown as HrDocumentRequestQueueRow),
      );
    },
  });
}

/**
 * Single request by ID with employee + filer joins.
 */
export function useHrDocumentRequest(id: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, "detail", id],
    queryFn: async (): Promise<HrDocumentRequestQueueItem> => {
      const { data, error } = await supabase
        .from("hr_document_requests")
        .select(
          "*, filer:filed_by(full_name, work_name), employee:employee_id!hr_document_requests_employee_id_fkey(full_name, work_name, campaign_id, campaigns!employees_campaign_id_fkey(name))",
        )
        .eq("id", id!)
        .single();

      if (error) throw error;
      return mapQueueRow(data as unknown as HrDocumentRequestQueueRow);
    },
    enabled: !!id,
  });
}

/**
 * Update request status. Supports: pending→in_progress, pending/in_progress→canceled/downgraded.
 * Does NOT support →fulfilled (requires Phase 4 finalization row) or →pending.
 */
export function useUpdateHrDocumentRequestStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      employeeId,
      status,
      canceledReason,
    }: {
      id: string;
      employeeId: string;
      status: "in_progress" | "canceled" | "downgraded";
      canceledReason?: string;
    }) => {
      const { error } = await supabase
        .from("hr_document_requests")
        .update({
          status,
          canceled_reason:
            status === "canceled" || status === "downgraded"
              ? (canceledReason ?? null)
              : null,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      // Invalidate all queue filters + detail + employee-scoped list
      qc.invalidateQueries({ queryKey: [QUERY_KEY, "queue"] });
      qc.invalidateQueries({ queryKey: [QUERY_KEY, "detail", vars.id] });
      qc.invalidateQueries({
        queryKey: [QUERY_KEY, "by_employee", vars.employeeId],
      });
    },
  });
}

// ── Phase 4a: Finalization (draft) hooks ────────────────────────────

const FINALIZATION_KEY = "hr_finalization";

export interface FinalizationDraft {
  id: string;
  employeeId: string;
  requestId: string | null;
  docRef: string | null;
  incidentDate: string;
  narrative: string | null;
  trabajadorNameSnapshot: string | null;
  puestoSnapshot: string | null;
  horarioSnapshot: string | null;
  supervisorNameSnapshot: string | null;
  companyLegalNameSnapshot: string | null;
  companyLegalAddressSnapshot: string | null;
  incidentDateLongSnapshot: string | null;
  pdfPath: string | null;
  signedAt: string | null;
  signedScanPath: string | null;
  createdAt: string;
  updatedAt: string;
  type: "carta" | "acta";
  // Carta-specific
  kpiTable: CartaKpiRow[];
  // Acta-specific
  witnesses: ActaWitness[];
  reincidenciaPriorCartaId: string | null;
}

function mapFinalizationRow(
  row: Record<string, unknown>,
  type: "carta" | "acta",
): FinalizationDraft {
  return {
    id: row.id as string,
    employeeId: row.employee_id as string,
    requestId: (row.request_id as string) ?? null,
    docRef: (row.doc_ref as string) ?? null,
    incidentDate: row.incident_date as string,
    narrative: (row.narrative as string) ?? null,
    trabajadorNameSnapshot: (row.trabajador_name_snapshot as string) ?? null,
    puestoSnapshot: (row.puesto_snapshot as string) ?? null,
    horarioSnapshot: (row.horario_snapshot as string) ?? null,
    supervisorNameSnapshot: (row.supervisor_name_snapshot as string) ?? null,
    companyLegalNameSnapshot:
      (row.company_legal_name_snapshot as string) ?? null,
    companyLegalAddressSnapshot:
      (row.company_legal_address_snapshot as string) ?? null,
    incidentDateLongSnapshot:
      (row.incident_date_long_snapshot as string) ?? null,
    pdfPath: (row.pdf_path as string) ?? null,
    signedAt: (row.signed_at as string) ?? null,
    signedScanPath: (row.signed_scan_path as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    type,
    kpiTable: (row.kpi_table as CartaKpiRow[]) ?? [],
    witnesses: (row.witnesses as ActaWitness[]) ?? [],
    reincidenciaPriorCartaId:
      (row.reincidencia_prior_carta_id as string) ?? null,
  };
}

/**
 * Fetch the linked carta/acta draft for a request (if any).
 */
export function useHrFinalization(
  requestId: string | undefined,
  requestType: HrDocumentRequestType | undefined,
) {
  return useQuery({
    queryKey: [FINALIZATION_KEY, requestId],
    queryFn: async (): Promise<FinalizationDraft | null> => {
      const table =
        requestType === "acta"
          ? "actas_administrativas"
          : "cartas_compromiso";

      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("request_id", requestId!)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return mapFinalizationRow(
        data as Record<string, unknown>,
        requestType!,
      );
    },
    enabled: !!requestId && !!requestType,
  });
}

/**
 * Call the hr_create_finalization_draft RPC to atomically create
 * the carta/acta row and link it to the request.
 */
export function useCreateHrFinalizationDraft() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      createdBy,
    }: {
      requestId: string;
      createdBy: string;
      employeeId: string; // for cache invalidation
    }) => {
      const { data, error } = await supabase.rpc(
        "hr_create_finalization_draft",
        { p_request_id: requestId, p_created_by: createdBy },
      );
      if (error) throw error;
      return data as { id: string; type: string; doc_ref: string };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [FINALIZATION_KEY, vars.requestId] });
      qc.invalidateQueries({ queryKey: [QUERY_KEY, "detail", vars.requestId] });
      qc.invalidateQueries({ queryKey: [QUERY_KEY, "queue"] });
      qc.invalidateQueries({
        queryKey: [QUERY_KEY, "by_employee", vars.employeeId],
      });
    },
  });
}

export interface DraftUpdateFields {
  narrative?: string | null;
  trabajador_name_snapshot?: string | null;
  puesto_snapshot?: string | null;
  horario_snapshot?: string | null;
  supervisor_name_snapshot?: string | null;
  company_legal_name_snapshot?: string | null;
  company_legal_address_snapshot?: string | null;
  incident_date_long_snapshot?: string | null;
  kpi_table?: CartaKpiRow[];
  witnesses?: ActaWitness[];
  reincidencia_prior_carta_id?: string | null;
}

/**
 * Save draft fields to the carta/acta row.
 */
export function useSaveFinalizationDraft() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      draftId,
      type,
      fields,
    }: {
      draftId: string;
      type: "carta" | "acta";
      fields: DraftUpdateFields;
      requestId: string; // for cache invalidation
    }) => {
      const table =
        type === "acta" ? "actas_administrativas" : "cartas_compromiso";

      const { error } = await supabase
        .from(table)
        .update(fields)
        .eq("id", draftId);

      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: [FINALIZATION_KEY, vars.requestId],
      });
    },
  });
}

/**
 * Find the most recent signed carta for an employee (for reincidencia auto-cite).
 * Returns null if no prior signed carta exists.
 */
export function usePriorSignedCartaForEmployee(
  employeeId: string | undefined,
) {
  return useQuery({
    queryKey: ["prior_signed_carta", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cartas_compromiso")
        .select("id, doc_ref, created_at, signed_at")
        .eq("employee_id", employeeId!)
        .not("signed_at", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as {
        id: string;
        doc_ref: string | null;
        created_at: string;
        signed_at: string;
      } | null;
    },
    enabled: !!employeeId,
  });
}

/**
 * Fetch a single carta by ID (for reincidencia display on PDF).
 */
export function useCartaById(id: string | null | undefined) {
  return useQuery({
    queryKey: ["carta_by_id", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cartas_compromiso")
        .select("id, doc_ref, created_at")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as { id: string; doc_ref: string | null; created_at: string };
    },
    enabled: !!id,
  });
}

/**
 * Upload a finalized PDF to hr-documents bucket and save pdf_path.
 */
export function useUploadFinalizedPdf() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      draftId,
      type,
      employeeId,
      docRef,
      pdfBlob,
    }: {
      draftId: string;
      type: "carta" | "acta";
      employeeId: string;
      docRef: string;
      pdfBlob: Blob;
      requestId: string;
    }) => {
      const year = new Date().getFullYear();
      const folder = type === "carta" ? "cartas" : "actas";
      const path = `${folder}/${year}/${employeeId}/${docRef}.pdf`;

      const { error: upErr } = await supabase.storage
        .from("hr-documents")
        .upload(path, pdfBlob, {
          contentType: "application/pdf",
          upsert: true,
        });
      if (upErr) throw upErr;

      const table =
        type === "acta" ? "actas_administrativas" : "cartas_compromiso";
      const { error: dbErr } = await supabase
        .from(table)
        .update({ pdf_path: path })
        .eq("id", draftId);
      if (dbErr) throw dbErr;

      return path;
    },
    onSuccess: (_path, vars) => {
      qc.invalidateQueries({ queryKey: [FINALIZATION_KEY, vars.requestId] });
      qc.invalidateQueries({
        queryKey: [QUERY_KEY, "detail", vars.requestId],
      });
      qc.invalidateQueries({ queryKey: [QUERY_KEY, "queue"] });
      qc.invalidateQueries({
        queryKey: [QUERY_KEY, "by_employee", vars.employeeId],
      });
    },
  });
}
