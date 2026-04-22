import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  HrDocumentRequest,
  HrDocumentRequestType,
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
