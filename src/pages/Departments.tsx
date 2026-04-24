import { useState } from "react";
import {
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeactivateDepartment,
  type Department,
} from "@/hooks/useDepartments";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LogoLoadingIndicator } from "@/components/ui/LogoLoadingIndicator";
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

export default function Departments() {
  const { data: departments = [], isLoading } = useDepartments();
  const createDept = useCreateDepartment();
  const updateDept = useUpdateDepartment();
  const deactivateDept = useDeactivateDepartment();

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", sort_order: 0 });

  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", sort_order: 0 });

  const active = departments.filter((d) => d.is_active);
  const inactive = departments.filter((d) => !d.is_active);

  const handleAdd = () => {
    if (!addForm.name.trim()) {
      toast.error("Name is required");
      return;
    }
    createDept.mutate(
      {
        name: addForm.name.trim(),
        sort_order: addForm.sort_order || (active.length + 1),
      },
      {
        onSuccess: () => {
          toast.success("Department added");
          setAddOpen(false);
          setAddForm({ name: "", sort_order: 0 });
        },
        onError: (err: unknown) => toast.error((err as Error).message ?? "Unknown error"),
      }
    );
  };

  const openEdit = (dept: Department) => {
    setEditId(dept.id);
    setEditForm({ name: dept.name, sort_order: dept.sort_order });
  };

  const handleEdit = () => {
    if (!editId || !editForm.name.trim()) return;
    updateDept.mutate(
      {
        id: editId,
        data: {
          name: editForm.name.trim(),
          sort_order: editForm.sort_order,
        },
      },
      {
        onSuccess: () => {
          toast.success("Department updated");
          setEditId(null);
        },
        onError: (err: unknown) => toast.error((err as Error).message ?? "Unknown error"),
      }
    );
  };

  const handleDeactivate = (id: string) => {
    deactivateDept.mutate(id, {
      onSuccess: () => toast.success("Department deactivated"),
      onError: (err: unknown) => toast.error((err as Error).message ?? "Unknown error"),
    });
  };

  const handleReactivate = (id: string) => {
    updateDept.mutate(
      { id, data: { is_active: true } },
      {
        onSuccess: () => toast.success("Department reactivated"),
        onError: (err: unknown) => toast.error((err as Error).message ?? "Unknown error"),
      }
    );
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><LogoLoadingIndicator /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Departments</h2>
          <p className="text-sm text-muted-foreground">
            Manage departments that can be assigned to employees.
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Department</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Department</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Sales Agent"
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
              <Button onClick={handleAdd} disabled={createDept.isPending}>
                {createDept.isPending ? "Adding..." : "Add"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active departments */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Order</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No active departments. Add one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                active.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-mono text-sm">{dept.sort_order}</TableCell>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-800">Active</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(dept)} aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeactivate(dept.id)} aria-label="Deactivate">
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

      {/* Inactive departments */}
      {inactive.length > 0 && (
        <>
          <h3 className="text-lg font-semibold text-muted-foreground">Deactivated</h3>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableBody>
                  {inactive.map((dept) => (
                    <TableRow key={dept.id} className="opacity-50">
                      <TableCell className="font-mono text-sm w-16">{dept.sort_order}</TableCell>
                      <TableCell className="font-medium">{dept.name}</TableCell>
                      <TableCell className="w-28">
                        <Badge variant="outline" className="bg-muted text-muted-foreground">Inactive</Badge>
                      </TableCell>
                      <TableCell className="w-24">
                        <Button variant="ghost" size="icon" onClick={() => handleReactivate(dept.id)} aria-label="Reactivate">
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
          <DialogHeader><DialogTitle>Edit Department</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
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
            <Button onClick={handleEdit} disabled={updateDept.isPending}>
              {updateDept.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
