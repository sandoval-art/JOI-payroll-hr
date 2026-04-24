import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Count of time_off_requests with status='pending'.
 * RLS scopes automatically. Used by sidebar badge. Polls every 30s.
 */
export function usePendingTimeOffCount() {
  return useQuery({
    queryKey: ["time_off_requests", "pending_count"],
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("time_off_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });
}
