import { useState } from "react";
import {
  useRequiredDocumentTypes,
  useCreateDocumentType,
  useUpdateDocumentType,
  useDeactivateDocumentType,
  type DocumentType,
} from "@/hooks/useDocumentTypes";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, XCircle, RotateCcw } from "lucide-react";

export default function DocumentTypes() {
  const { data: docTypes = [], isLoading } = useRequiredDocumentTypes();
  const createType = useCreateDocumentType();
  const updateType = useUpdateDocumentType();
  const deactivateType = useDeactivateDocumentType();

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", description: "", sort_order: 0 });

  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", sort_order: 0 });

  const active = docTypes.filter((d) => d.is_active);
  const inactive = docTypes.filter((d) => !d.is_active);

  const handleAdd = () => {
    if (!addForm.name.trim()) {
      toast.error("Name is required");
      return;
    }
    createType.mutate(
      {
        name: addForm.name.trim(),
        description: addForm.description.trim() || undefined,
        sort_order: addForm.sort_order || (active.length + 1),
      },
      {
        onSuccess: () => {
          toast.success("Document type added");
          setAddOpen(false);
          setAddForm({ name: "", description: "", sort_order: 0 });
        },
        onError: (err: unknown) => toast.error((err as Error).message ?? "Unknown error"),
      }
    );
  };

  const openEdit = (dt: DocumentType) => {
    setEditId(dt.id);
    setEditForm({ name: dt.name, description: dt.description || "", sort_order: dt.sort_order });
  };

  const handleEdit = () => {
    if (!editId || !editForm.name.trim()) return;
    updateType.mutate(
      {
        id: editId,
        data: {
          name: editForm.name.trim(),
          description: editForm.description.trim() || null,
          sort_order: editForm.sort_order,
        },
      },
      {
        onSuccess: () => {
          toast.success("Document type updated");
          setEditId(null);
        },
        onError: (err: unknown) => toast.error((err as Error).message ?? "Unknown error"),
      }
    );
  };

  const handleDeactivate = (id: string) => {
    deactivateType.mutate(id, {
      onSuccess: () => toast.success("Document type deactivated"),
      onError: (err: unknown) => toast.error((err as Error).message ?? "Unknown error"),
    });
  };

  const handleReactivate = (id: string) => {
    updateType.mutate(
      { id, data: { is_active: true } },
      {
        onSuccess: () => toast.success("Document type reactivated"),
        onError: (err: unknown) => toast.error((err as Error).message ?? "Unknown error"),
      }
    );
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Required Document Types</h2>
          <p className="text-sm text-muted-foreground">
            Define what documents every agent must submit. Used by the compliance checklist.
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Document Type</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Document Type</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Signed contract"
                />
              </div>
              <div className="grid gap-2">
                <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  value={addForm.description}
                  onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Contrato individual de trabajo firmado"
                />
              </div>
              <div className="grid gap-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={addForm.sort_order || ""}
                  onChange={(e) => setAddForm((f) => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                  placeholder="Auto-assigned if left blank"
                />
              </div>
              <Button onClick={handleAdd} disabled={createType.isPending}>
                {createType.isPending ? "Adding..." : "Add"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active types */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Order</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No active document types. Add one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                active.map((dt) => (
                  <TableRow key={dt.id}>
                    <TableCell className="font-mono text-sm">{dt.sort_order}</TableCell>
                    <TableCell className="font-medium">{dt.name}</TableCell>
                    <TableCell className="text-muted-foreground">{dt.description || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-800">Active</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(dt)} aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeactivate(dt.id)} aria-label="Deactivate">
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Inactive types */}
      {inactive.length > 0 && (
        <>
          <h3 className="text-lg font-semibold text-muted-foreground">Deactivated</h3>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableBody>
                  {inactive.map((dt) => (
                    <TableRow key={dt.id} className="opacity-50">
                      <TableCell className="font-mono text-sm w-16">{dt.sort_order}</TableCell>
                      <TableCell className="font-medium">{dt.name}</TableCell>
                      <TableCell className="text-muted-foreground">{dt.description || "—"}</TableCell>
                      <TableCell className="w-28">
                        <Badge variant="outline" className="bg-muted text-muted-foreground">Inactive</Badge>
                      </TableCell>
                      <TableCell className="w-24">
                        <Button variant="ghost" size="icon" onClick={() => handleReactivate(dt.id)} aria-label="Reactivate">
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editId} onOpenChange={(open) => { if (!open) setEditId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Document Type</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={editForm.sort_order}
                onChange={(e) => setEditForm((f) => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <Button onClick={handleEdit} disabled={updateType.isPending}>
              {updateType.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
