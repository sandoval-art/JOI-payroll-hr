import { Badge } from "@/components/ui/badge";
import type { EmployeeDocument } from "@/hooks/useEmployeeDocuments";

interface Props {
  document: EmployeeDocument | null;
  missingLabel?: string;
}

export function DocumentStatusBadge({ document: doc, missingLabel = "Missing" }: Props) {
  if (!doc) return <Badge variant="outline" className="bg-muted text-muted-foreground">{missingLabel}</Badge>;
  if (doc.status === "pending_review") return <Badge variant="outline" className="bg-amber-50 text-amber-800">Pending review</Badge>;
  if (doc.status === "approved") return <Badge variant="outline" className="bg-emerald-50 text-emerald-800">Approved</Badge>;
  if (doc.status === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  return null;
}
