import { useState } from "react";
import {
  usePolicies,
  usePolicyVersions,
  useCreatePolicy,
  useUpdatePolicyMetadata,
  usePublishNewVersion,
  getPolicyFileSignedUrl,
  type PolicyDocument,
  type PolicyDocumentVersion,
} from "@/hooks/usePolicies";
import { LogoLoadingIndicator } from "@/components/ui/LogoLoadingIndicator";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDateMXLong } from "@/lib/localDate";
import { getDisplayName } from "@/lib/displayName";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Eye, Upload, History, ScrollText, XCircle, RotateCcw } from "lucide-react";
import { ACCEPTED_DOCUMENT_EXTENSIONS } from "@/lib/documentUpload";

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "team_lead", label: "Team Lead" },
  { value: "agent", label: "Agent" },
];

export default function Policies() {
  const { employeeId: authEmployeeId } = useAuth();
  const { data: policies = [], isLoading } = usePolicies();
  const createPolicy = useCreatePolicy();
  const updateMetadata = useUpdatePolicyMetadata();
  const publishVersion = usePublishNewVersion();

  const [createOpen, setCreateOpen] = useState(false);
  const [versionTarget, setVersionTarget] = useState<PolicyDocument | null>(null);
  const [historyTarget, setHistoryTarget] = useState<PolicyDocument | null>(null);

  // Create form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isGlobal, setIsGlobal] = useState(true);
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [allRoles, setAllRoles] = useState(true);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [changeNotes, setChangeNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Upload new version form
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [versionNotes, setVersionNotes] = useState("");

  // Campaigns for scope picker
  const { data: campaigns = [] } = useQuery({
    queryKey: ["all-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const active = policies.filter((p) => p.is_active);
  const inactive = policies.filter((p) => !p.is_active);

  const resetCreateForm = () => {
    setTitle("");
    setDescription("");
    setIsGlobal(true);
    setSelectedCampaigns([]);
    setAllRoles(true);
    setSelectedRoles([]);
    setChangeNotes("");
    setFile(null);
  };

  const handleCreate = () => {
    if (!title.trim() || !file || !authEmployeeId) return;
    createPolicy.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        isGlobal,
        scopedCampaignIds: isGlobal ? undefined : selectedCampaigns,
        applicableRoles: allRoles ? undefined : selectedRoles,
        file,
        changeNotes: changeNotes.trim() || undefined,
        uploadedBy: authEmployeeId,
      },
      {
        onSuccess: () => {
          toast.success("Policy created");
          setCreateOpen(false);
          resetCreateForm();
        },
        onError: (err) => toast.error((err as Error).message),
      }
    );
  };

  const handlePublishVersion = () => {
    if (!versionTarget || !versionFile || !authEmployeeId) return;
    publishVersion.mutate(
      {
        policyId: versionTarget.id,
        file: versionFile,
        changeNotes: versionNotes.trim() || undefined,
        uploadedBy: authEmployeeId,
      },
      {
        onSuccess: () => {
          toast.success("New version published");
          setVersionTarget(null);
          setVersionFile(null);
          setVersionNotes("");
        },
        onError: (err) => toast.error((err as Error).message),
      }
    );
  };

  const handleToggleActive = (policy: PolicyDocument) => {
    updateMetadata.mutate(
      { id: policy.id, data: { is_active: !policy.is_active } },
      {
        onSuccess: () => toast.success(policy.is_active ? "Policy deactivated" : "Policy reactivated"),
        onError: (err) => toast.error((err as Error).message),
      }
    );
  };

  const handleViewFile = async (filePath: string) => {
    try {
      const url = await getPolicyFileSignedUrl(filePath);
      window.open(url, "_blank");
    } catch {
      toast.error("Failed to generate view link");
    }
  };

  const scopeSummary = (p: PolicyDocument) => {
    const parts: string[] = [];
    parts.push(p.is_global ? "Global" : `${p.scoped_campaign_ids?.length ?? 0} campaign(s)`);
    parts.push(p.applicable_roles ? p.applicable_roles.join(", ") : "All roles");
    return parts.join(" · ");
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><LogoLoadingIndicator /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Policies</h2>
          <p className="text-sm text-muted-foreground">
            Manage company policies. Agents will see applicable policies and acknowledge them.
          </p>
        </div>
        <Button onClick={() => { resetCreateForm(); setCreateOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> New Policy
        </Button>
      </div>

      {/* Active policies */}
      <Card>
        <CardHeader><CardTitle>Active Policies</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No active policies. Create one to get started.</p>
          ) : (
            active.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-3 rounded-lg border p-4">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{scopeSummary(p)}</p>
                  {p.current_version && (
                    <p className="text-xs text-muted-foreground">
                      v{p.current_version.version_number} · Published {formatDateMXLong(p.current_version.published_at)}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  {p.current_version && (
                    <Button variant="ghost" size="sm" aria-label="View document" onClick={() => handleViewFile(p.current_version!.file_path)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" aria-label="Upload new version" onClick={() => { setVersionFile(null); setVersionNotes(""); setVersionTarget(p); }}>
                    <Upload className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" aria-label="Version history" onClick={() => setHistoryTarget(p)}>
                    <History className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" aria-label="Deactivate" onClick={() => handleToggleActive(p)}>
                    <XCircle className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Inactive policies */}
      {inactive.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-muted-foreground">Inactive</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {inactive.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border p-4 opacity-50">
                <div>
                  <p className="font-medium">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{scopeSummary(p)}</p>
                </div>
                <Button variant="ghost" size="sm" aria-label="Reactivate" onClick={() => handleToggleActive(p)}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Create policy dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) setCreateOpen(false); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Policy</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Code of Conduct" />
            </div>
            <div className="grid gap-2">
              <Label>Description (optional)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief summary of the policy" rows={2} />
            </div>
            <Separator />
            <div className="space-y-3">
              <Label>Scope</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={isGlobal} onChange={() => setIsGlobal(true)} className="accent-primary" />
                  <span className="text-sm">Global (all campaigns)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={!isGlobal} onChange={() => setIsGlobal(false)} className="accent-primary" />
                  <span className="text-sm">Specific campaigns</span>
                </label>
              </div>
              {!isGlobal && (
                <div className="grid gap-1 max-h-32 overflow-y-auto border rounded p-2">
                  {campaigns.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={selectedCampaigns.includes(c.id)}
                        onChange={(e) => {
                          setSelectedCampaigns((prev) =>
                            e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                          );
                        }}
                        className="accent-primary"
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-3">
              <Label>Applicable roles</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={allRoles} onChange={() => setAllRoles(true)} className="accent-primary" />
                  <span className="text-sm">All roles</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={!allRoles} onChange={() => setAllRoles(false)} className="accent-primary" />
                  <span className="text-sm">Specific roles</span>
                </label>
              </div>
              {!allRoles && (
                <div className="flex flex-wrap gap-3">
                  {ROLE_OPTIONS.map((r) => (
                    <label key={r.value} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(r.value)}
                        onChange={(e) => {
                          setSelectedRoles((prev) =>
                            e.target.checked ? [...prev, r.value] : prev.filter((v) => v !== r.value)
                          );
                        }}
                        className="accent-primary"
                      />
                      {r.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <Separator />
            <div className="grid gap-2">
              <Label htmlFor="create-policy-file">Document file (required)</Label>
              <input
                id="create-policy-file"
                type="file"
                accept={ACCEPTED_DOCUMENT_EXTENSIONS}
                className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Change notes (optional)</Label>
              <Input value={changeNotes} onChange={(e) => setChangeNotes(e.target.value)} placeholder="e.g. Initial version" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createPolicy.isPending || !title.trim() || !file}>
              {createPolicy.isPending ? "Creating..." : "Create Policy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload new version dialog */}
      <Dialog open={!!versionTarget} onOpenChange={(o) => { if (!o) setVersionTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload New Version — {versionTarget?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Current version: v{versionTarget?.current_version?.version_number ?? 0}
            </p>
            <div className="grid gap-2">
              <Label htmlFor="new-version-file">New file</Label>
              <input
                id="new-version-file"
                type="file"
                accept={ACCEPTED_DOCUMENT_EXTENSIONS}
                className="text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium"
                onChange={(e) => setVersionFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Change notes (optional)</Label>
              <Input value={versionNotes} onChange={(e) => setVersionNotes(e.target.value)} placeholder="What changed in this version?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVersionTarget(null)}>Cancel</Button>
            <Button onClick={handlePublishVersion} disabled={publishVersion.isPending || !versionFile}>
              {publishVersion.isPending ? "Publishing..." : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version history dialog */}
      {historyTarget && (
        <VersionHistoryDialog
          policy={historyTarget}
          onClose={() => setHistoryTarget(null)}
          onViewFile={handleViewFile}
        />
      )}
    </div>
  );
}

function VersionHistoryDialog({
  policy,
  onClose,
  onViewFile,
}: {
  policy: PolicyDocument;
  onClose: () => void;
  onViewFile: (path: string) => void;
}) {
  const { data: versions = [], isLoading } = usePolicyVersions(policy.id);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Version History — {policy.title}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <LogoLoadingIndicator size="sm" />
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No versions yet.</p>
        ) : (
          <ul className="space-y-3">
            {versions.map((v) => (
              <li key={v.id} className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">v{v.version_number}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDateMXLong(v.published_at)}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => onViewFile(v.file_path)}>
                    <Eye className="mr-1 h-3 w-3" /> View
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {v.uploader ? getDisplayName({ work_name: (v.uploader as { full_name: string; work_name?: string | null }).work_name, full_name: v.uploader.full_name }) : "Unknown"} · {v.file_name}
                </p>
                {v.change_notes && <p className="text-sm">{v.change_notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
