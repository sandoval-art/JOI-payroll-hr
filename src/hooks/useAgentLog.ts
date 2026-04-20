import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AgentLogEntry {
  id: string;
  agent_id: string;
  author_id: string;
  campaign_id: string;
  entry_type: "note" | "verbal_warning";
  note: string;
  visible_to_agent: boolean;
  created_at: string;
  updated_at: string;
  author?: { full_name: string } | null;
}

const QUERY_KEY = "agent-log-entries";

export function useAgentLogEntries(agentId: string | undefined | null) {
  return useQuery({
    queryKey: [QUERY_KEY, agentId],
    queryFn: async () => {
      if (!agentId) return [];
      const { data, error } = await supabase
        .from("agent_coaching_notes")
        .select("*, author:author_id(full_name)")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as AgentLogEntry[];
    },
    enabled: !!agentId,
  });
}

export function useCreateAgentLogEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      agentId,
      entryType,
      note,
      campaignId,
      authorId,
      visibleToAgent = false,
    }: {
      agentId: string;
      entryType: "note" | "verbal_warning";
      note: string;
      campaignId: string;
      authorId: string;
      visibleToAgent?: boolean;
    }) => {
      const { data, error } = await supabase
        .from("agent_coaching_notes")
        .insert({
          agent_id: agentId,
          author_id: authorId,
          campaign_id: campaignId,
          entry_type: entryType,
          note,
          visible_to_agent: visibleToAgent,
        })
        .select("*, author:author_id(full_name)")
        .single();
      if (error) throw error;
      return data as AgentLogEntry;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, vars.agentId] });
    },
  });
}

export function useToggleEntryVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      agentId,
      visibleToAgent,
    }: {
      id: string;
      agentId: string;
      visibleToAgent: boolean;
    }) => {
      const { error } = await supabase
        .from("agent_coaching_notes")
        .update({ visible_to_agent: visibleToAgent })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY, vars.agentId] });
    },
  });
}
