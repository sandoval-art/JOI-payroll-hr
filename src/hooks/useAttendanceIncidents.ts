import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ACCEPTED_DOCUMENT_TYPES, MAX_DOCUMENT_SIZE_BYTES } from "@/lib/documentUpload";

export type IncidentType = "late" | "sick" | "no_call_no_show" | "medical_leave" | "personal" | "bereavement" | "other";

export interface AttendanceIncident {
  id: string;
  employee_id: string;
  date: string;
  incident_type: IncidentType;
  notes: string | null;
  supporting_doc_path: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator?: { full_name: string } | null;
}

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  late: "Late",
  sick: "Sick",
  no_call_no_show: "No Call / No Show",
  medical_leave: "Medical Leave",
  personal: "Personal",
  bereavement: "Bereavement",
  other: "Other",
};

const QUERY_KEY = "attendance-incidents";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function useAgentIncidents(agentId: string | undefined | null) {
  return useQuery({
    queryKey: [QUERY_KEY, agentId],
    queryFn: async () => {
      if (!agentId) return [];
      const { data, error } = await supabase
        .from("attendance_incidents")
        .select("*, creator:created_by(full_name)")
        .eq("employee_id", agentId)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data || []) as AttendanceIncident[];
    },
    enabled: !!agentId,
  });
}

export function useCreateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      employeeId,
      date,
      incidentType,
      notes,
      file,
    }: {
      employeeId: string;
      date: string;
      incidentType: IncidentType;
      notes?: string;
      file?: File;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let supportingDocPath: string | null = null;

      if (file) {
        if (!ACCEPTED_DOCUMENT_TYPES.includes(file.type)) {
          throw new Error("Unsupported file type. Please upload PDF, JPG, or PNG.");
        }
        if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
          throw new Error("File too large. Maximum size is 10 MB.");
        }
        const timestamp = Date.now();
        const safeName = sanitizeFilename(file.name);
        supportingDocPath = `${employeeId}/${timestamp}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("attendance-docs")
          .upload(supportingDocPath, file, { upsert: false });
        if (uploadError) throw uploadError;
      }

      const { data, error } = await supabase
        .from("attendance_incidents")
        .upsert(
          {
            employee_id: employeeId,
            date,
            incident_type: incidentType,
            notes: notes?.trim() || null,
            supporting_doc_path: supportingDocPath,
            created_by: user.id,
          },
          { onConflict: "employee_id,date" }
        )
        .select("*, creator:created_by(full_name)")
        .single();
      if (error) throw error;
      return data as AttendanceIncident;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, vars.employeeId] });
    },
  });
}

export function useUpdateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      employeeId,
      incidentType,
      notes,
      file,
    }: {
      id: string;
      employeeId: string;
      incidentType?: IncidentType;
      notes?: string | null;
      file?: File;
    }) => {
      let supportingDocPath: string | undefined;

      if (file) {
        if (!ACCEPTED_DOCUMENT_TYPES.includes(file.type)) {
          throw new Error("Unsupported file type. Please upload PDF, JPG, or PNG.");
        }
        if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
          throw new Error("File too large. Maximum size is 10 MB.");
        }
        const timestamp = Date.now();
        const safeName = sanitizeFilename(file.name);
        supportingDocPath = `${employeeId}/${timestamp}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("attendance-docs")
          .upload(supportingDocPath, file, { upsert: false });
        if (uploadError) throw uploadError;
      }

      const update: Record<string, unknown> = {};
      if (incidentType !== undefined) update.incident_type = incidentType;
      if (notes !== undefined) update.notes = notes?.trim() || null;
      if (supportingDocPath !== undefined) update.supporting_doc_path = supportingDocPath;

      const { error } = await supabase
        .from("attendance_incidents")
        .update(update)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, vars.employeeId] });
    },
  });
}

export async function getIncidentDocSignedUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("attendance-docs")
    .createSignedUrl(filePath, 60 * 5); // 5 minutes
  if (error) throw error;
  return data.signedUrl;
}
