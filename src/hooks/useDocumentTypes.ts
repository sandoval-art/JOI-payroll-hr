import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DocumentType {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = ["required_document_types"];

export function useRequiredDocumentTypes() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("required_document_types")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as DocumentType[];
    },
  });
}

export function useCreateDocumentType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string; sort_order?: number }) => {
      const { data, error } = await supabase
        .from("required_document_types")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data as DocumentType;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateDocumentType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Pick<DocumentType, "name" | "description" | "sort_order" | "is_active">> }) => {
      const { error } = await supabase
        .from("required_document_types")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeactivateDocumentType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("required_document_types")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
