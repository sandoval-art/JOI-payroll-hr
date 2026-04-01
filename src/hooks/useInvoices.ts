import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Client {
  id: string;
  name: string;
  prefix: string;
  bill_to_name: string | null;
  bill_to_address: string | null;
}

export interface Invoice {
  id: string;
  client_id: string;
  invoice_number: string;
  week_number: number;
  week_start: string;
  week_end: string;
  due_date: string;
  status: string;
  created_at: string;
  client?: Client;
}

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  agent_name: string;
  days_worked: number;
  unit_price: number;
  total: number;
  spiffs: number;
  total_price: number;
}

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as Client[];
    },
  });
}

export function useInvoices(clientId?: string) {
  return useQuery({
    queryKey: ["invoices", clientId],
    queryFn: async () => {
      let query = supabase
        .from("invoices")
        .select("*, clients(*)")
        .order("created_at", { ascending: false });
      if (clientId) {
        query = query.eq("client_id", clientId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((row: any) => ({
        ...row,
        client: row.clients,
      })) as Invoice[];
    },
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ["invoice", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: invoice, error: invError } = await supabase
        .from("invoices")
        .select("*, clients(*)")
        .eq("id", id!)
        .single();
      if (invError) throw invError;

      const { data: lines, error: linesError } = await supabase
        .from("invoice_lines")
        .select("*")
        .eq("invoice_id", id!)
        .order("agent_name");
      if (linesError) throw linesError;

      return {
        ...invoice,
        client: (invoice as any).clients,
        lines: (lines || []) as InvoiceLine[],
      } as Invoice & { lines: InvoiceLine[] };
    },
  });
}

export function useAgentsByClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ["agentsByClient", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, employee_id, shift_type")
        .eq("is_active", true)
        .eq("client_id", clientId!);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      invoice,
      lines,
    }: {
      invoice: {
        client_id: string;
        invoice_number: string;
        week_number: number;
        week_start: string;
        week_end: string;
        due_date: string;
        status: string;
      };
      lines: {
        agent_name: string;
        days_worked: number;
        unit_price: number;
        total: number;
        spiffs: number;
        total_price: number;
      }[];
    }) => {
      const { data: inv, error: invError } = await supabase
        .from("invoices")
        .insert(invoice)
        .select()
        .single();
      if (invError) throw invError;

      if (lines.length > 0) {
        const lineRows = lines.map((l) => ({ ...l, invoice_id: inv.id }));
        const { error: linesError } = await supabase
          .from("invoice_lines")
          .insert(lineRows);
        if (linesError) throw linesError;
      }

      return inv;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useUpdateInvoiceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("invoices")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice"] });
    },
  });
}

export const fmtUSD = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
