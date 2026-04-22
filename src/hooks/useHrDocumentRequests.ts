import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  HrDocumentRequest,
  HrDocumentRequestType,
  HrDocumentRequestStatus,
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
