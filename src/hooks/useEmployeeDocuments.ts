import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DocumentType } from "@/hooks/useDocumentTypes";

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  document_type_id: string;
  file_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  status: "pending_review" | "approved" | "rejected";
  rejection_reason: string | null;
  uploaded_by: string;
  uploaded_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  updated_at: string;
}

export interface DocumentWithType {
  type: DocumentType;
  document: EmployeeDocument | null;
}

const QUERY_KEY = "employee_documents";

/**
 * Returns all active required_document_types joined with the employee's
 * current document for each type (if any).
 */
export function useEmployeeDocuments(employeeId: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, employeeId],
    queryFn: async (): Promise<DocumentWithType[]> => {
      // Fetch both in parallel
      const [typesRes, docsRes] = await Promise.all([
        supabase
          .from("required_document_types")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("employee_documents")
          .select("*")
          .eq("employee_id", employeeId!),
      ]);

      if (typesRes.error) throw typesRes.error;
      if (docsRes.error) throw docsRes.error;

      const types = (typesRes.data || []) as DocumentType[];
      const docs = (docsRes.data || []) as EmployeeDocument[];

      const docsByType = new Map(docs.map((d) => [d.document_type_id, d]));

      return types.map((type) => ({
        type,
        document: docsByType.get(type.id) ?? null,
      }));
    },
    enabled: !!employeeId,
  });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Upload a file to storage + upsert the employee_documents row.
 */
export function useUploadDocument() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      employeeId,
      documentTypeId,
      file,
    }: {
      employeeId: string;
      documentTypeId: string;
      file: File;
    }) => {
      const timestamp = Date.now();
      const safeName = sanitizeFilename(file.name);
      const storagePath = `${employeeId}/${documentTypeId}/${timestamp}-${safeName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from("employee-documents")
        .upload(storagePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upsert document record (re-upload replaces via unique constraint)
      const { data, error } = await supabase
        .from("employee_documents")
        .upsert(
          {
            employee_id: employeeId,
            document_type_id: documentTypeId,
            file_path: storagePath,
            file_name: file.name,
            mime_type: file.type,
            file_size_bytes: file.size,
            status: "pending_review" as const,
            rejection_reason: null,
            uploaded_by: user.id,
            uploaded_at: new Date().toISOString(),
            reviewed_by: null,
            reviewed_at: null,
          },
          { onConflict: "employee_id,document_type_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return data as EmployeeDocument;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, vars.employeeId] });
    },
  });
}

/**
 * Approve or reject a document. Sets reviewed_by / reviewed_at automatically.
 */
export function useReviewDocument() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      employeeId,
      status,
      rejectionReason,
    }: {
      documentId: string;
      employeeId: string;
      status: "approved" | "rejected";
      rejectionReason?: string;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("employee_documents")
        .update({
          status,
          rejection_reason: status === "rejected" ? (rejectionReason ?? null) : null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", documentId);

      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, vars.employeeId] });
    },
  });
}

/**
 * Get a signed URL for viewing a document file.
 */
export async function getDocumentSignedUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("employee-documents")
    .createSignedUrl(filePath, 60 * 5); // 5 minutes

  if (error) throw error;
  return data.signedUrl;
}
