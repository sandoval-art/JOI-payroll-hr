import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  useMyApplicablePolicies,
  useMyPolicyAcks,
  useAcknowledgePolicy,
  getPolicyFileSignedUrl,
  type PolicyDocument,
} from "@/hooks/usePolicies";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ScrollText, Eye, CheckCircle2, AlertCircle } from "lucide-react";

export default function MyPolicies() {
  const { employeeId } = useAuth();

  // Fetch the current user's employee record for campaign + role
  const { data: myEmployee } = useQuery({
    queryKey: ["my-employee-record", employeeId],
    queryFn: async () => {
      if (!employeeId) return null;
      const { data, error } = await supabase
        .from("employees")
        .select("id, campaign_id, title")
        .eq("id", employeeId)
        .single();
      if (error) throw error;
      return data as { id: string; campaign_id: string | null; title: string };
    },
    enabled: !!employeeId,
  });

  const { data: policies = [], isLoading: policiesLoading } = useMyApplicablePolicies(
    myEmployee?.campaign_id ?? null,
    myEmployee?.title
  );
  const { data: acks = [], isLoading: acksLoading } = useMyPolicyAcks();
  const ackMutation = useAcknowledgePolicy();

  const ackedVersionIds = new Set(acks.map((a) => a.policy_document_version_id));

  const getStatus = (policy: PolicyDocument) => {
    const currentVersion = policy.current_version;
    if (!currentVersion) return "no_version" as const;
    if (ackedVersionIds.has(currentVersion.id)) return "acknowledged" as const;
    // Check if they ack'd an older version (outdated)
    // We'd need all version IDs — simplified: if there's any ack for this policy's versions, it's outdated
    // For now, just "not_acknowledged" — outdated detection requires version list
    return "not_acknowledged" as const;
  };

  const handleView = async (filePath: string) => {
    try {
      const url = await getPolicyFileSignedUrl(filePath);
      window.open(url, "_blank");
    } catch {
      toast.error("Failed to open document");
    }
  };

  const handleAck = (versionId: string) => {
    if (!employeeId) return;
    ackMutation.mutate(
      { versionId, employeeId },
      {
        onSuccess: () => toast.success("Policy acknowledged"),
        onError: (err) => toast.error((err as Error).message),
      }
    );
  };

  const isLoading = policiesLoading || acksLoading || !myEmployee;

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold">Policies</h2>
        <p className="text-sm text-muted-foreground">
          Review and acknowledge your company policies.
        </p>
      </div>

      {policies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ScrollText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No policies apply to you right now.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {policies.map((policy) => {
            const status = getStatus(policy);
            const currentVersion = policy.current_version;
            const isAcked = status === "acknowledged";

            return (
              <Card key={policy.id}>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold">{policy.title}</h3>
                      {policy.description && (
                        <p className="text-sm text-muted-foreground mt-1">{policy.description}</p>
                      )}
                    </div>
                    {isAcked ? (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 shrink-0">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Acknowledged
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 shrink-0">
                        <AlertCircle className="mr-1 h-3 w-3" /> Not acknowledged
                      </Badge>
                    )}
                  </div>

                  {/* Ack date or prompt */}
                  {isAcked && (
                    <p className="text-xs text-muted-foreground">
                      Acknowledged on {new Date(acks.find((a) => a.policy_document_version_id === currentVersion?.id)?.acknowledged_at ?? "").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  )}

                  {/* Version info */}
                  {currentVersion && (
                    <p className="text-xs text-muted-foreground">
                      Current version: v{currentVersion.version_number} · Published {new Date(currentVersion.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    {currentVersion && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleView(currentVersion.file_path)}
                      >
                        <Eye className="mr-1 h-3 w-3" /> View document
                      </Button>
                    )}
                    {currentVersion && !isAcked && (
                      <Button
                        size="sm"
                        onClick={() => handleAck(currentVersion.id)}
                        disabled={ackMutation.isPending}
                      >
                        {ackMutation.isPending ? "Saving..." : "I've read and agree"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
