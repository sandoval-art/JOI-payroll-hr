import { useState, useRef, useMemo } from "react";
import { useEmployees, useAddEmployee, useAddEmployeesBulk, useRemoveEmployee, useActivePeriod, usePayrollRecords, recordToConfig } from "@/hooks/useSupabasePayroll";
import { calcularNomina, type Employee, type EmpTitle } from "@/types/payroll";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { LogoLoadingIndicator } from "@/components/ui/LogoLoadingIndicator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Upload, Plus, Trash2, Download, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ClientCampaignPicker } from "@/components/ClientCampaignPicker";

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "MXN" });

const PAGE_OPTIONS = [15, 30, 60, 100];

export default function Empleados() {
  const { data: employees = [], isLoading } = useEmployees();
  const { data: activePeriod } = useActivePeriod();
  const { data: records = [] } = usePayrollRecords(activePeriod?.id);
  const addEmployee = useAddEmployee();
  const addEmployeesBulk = useAddEmployeesBulk();
  const removeEmployee = useRemoveEmployee();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nombre: "",
    email: "",
    sueldoBase: 0,
    descuentoPorDia: 0,
    kpiMonto: 0,
    title: "agent" as EmpTitle,
    clientId: null as string | null,
    campaignId: null as string | null,
  });

  // Filter, sort, and paginate
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = employees.filter(
      (e) =>
        e.nombre.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        ((e as any)._campaignName || "").toLowerCase().includes(q)
    );
    list.sort((a, b) => {
      const cmp = a.nombre.localeCompare(b.nombre, "es");
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [employees, search, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Reset to page 1 when search or page size changes
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };
  const handlePageSizeChange = (val: string) => {
    setPageSize(Number(val));
    setCurrentPage(1);
  };

  const handleAdd = () => {
    if (!form.nombre || !form.email) {
      toast.error("Name and email are required");
      return;
    }
    addEmployee.mutate(
      {
        id: "", // ignored — DB auto-generates
        nombre: form.nombre,
        sueldoBase: form.sueldoBase,
        descuentoPorDia: form.descuentoPorDia,
        kpiMonto: form.kpiMonto,
        title: form.title,
        email: form.email,
        campaignId: form.campaignId,
      },
      {
        onSuccess: (data) => {
          toast.success(`Employee added — ID: ${data.employee_id}`);
          setAddOpen(false);
          setForm({
            nombre: "",
            email: "",
            sueldoBase: 0,
            descuentoPorDia: 0,
            kpiMonto: 0,
            title: "agent",
            clientId: null,
            campaignId: null,
          });
        },
        onError: (err: any) => toast.error(err.message || "Error adding employee"),
      }
    );
  };

  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      const emps: Employee[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim());
        if (cols.length >= 5) {
          emps.push({
            id: cols[0],
            nombre: cols[1],
            sueldoBase: parseFloat(cols[2]) || 0,
            descuentoPorDia: parseFloat(cols[3]) || 0,
            kpiMonto: parseFloat(cols[4]) || 0,
          });
        }
      }
      if (emps.length) {
        addEmployeesBulk.mutate(emps, {
          onSuccess: () => toast.success(`${emps.length} employees imported`),
          onError: (err: any) => toast.error(err.message || "Error importing employees"),
        });
      } else {
        toast.error("No valid records found");
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><LogoLoadingIndicator /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">Employee Management</h2>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSV} />
          <Button variant="outline" onClick={() => {
            const header = "ID,Name,BaseSalary,DailyDiscount,KPI";
            const example = "EMP001,Juan Perez,15000,500,1000";
            const blob = new Blob([header + "\n" + example + "\n"], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "employee_template.csv";
            a.click();
            URL.revokeObjectURL(url);
          }}>
            <Download className="mr-2 h-4 w-4" /> CSV Template
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> Upload CSV
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> New Employee</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Employee</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Full Name</Label>
                  <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Monthly Base Salary</Label>
                  <Input type="number" value={form.sueldoBase || ""} onChange={(e) => setForm({ ...form, sueldoBase: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="grid gap-2">
                  <Label>Daily Absence Discount</Label>
                  <Input type="number" value={form.descuentoPorDia || ""} onChange={(e) => setForm({ ...form, descuentoPorDia: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="grid gap-2">
                  <Label>KPI Bonus Amount</Label>
                  <Input type="number" value={form.kpiMonto || ""} onChange={(e) => setForm({ ...form, kpiMonto: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="grid gap-2">
                  <Label>Title</Label>
                  <Select value={form.title} onValueChange={(v) => setForm({ ...form, title: v as EmpTitle })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="team_lead">Team Lead</SelectItem>
                      <SelectItem value="agent">Agent</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Title controls what they see in the app. Most hires are Agents.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="employee@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Used for login. An invite will be sent to set their password.
                  </p>
                </div>
                <ClientCampaignPicker
                  value={{ clientId: form.clientId, campaignId: form.campaignId }}
                  onChange={({ clientId, campaignId }) =>
                    setForm((f) => ({ ...f, clientId, campaignId }))
                  }
                />
                <Button onClick={handleAdd} disabled={addEmployee.isPending}>
                  {addEmployee.isPending ? "Saving..." : "Add Employee"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name, ID, or campaign..." value={search} onChange={(e) => handleSearchChange(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>
                  <button
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                    onClick={() => setSortAsc((prev) => !prev)}
                  >
                    Name
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-right">Base Salary</TableHead>
                <TableHead className="text-right">Biweekly Net</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No employees found
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((emp) => {
                  const rec = records.find((r: any) => r.employee_id === emp._uuid);
                  const config = recordToConfig(rec, emp.id);
                  const result = calcularNomina(emp, config);
                  return (
                    <TableRow key={emp.id} className="cursor-pointer" onClick={() => navigate(`/empleados/${emp.id}`)}>
                      <TableCell className="font-medium">{emp.id}</TableCell>
                      <TableCell>{emp.nombre}</TableCell>
                      <TableCell className="text-muted-foreground">{(emp as any)._campaignName || "—"}</TableCell>
                      <TableCell className="text-right">{fmt(emp.sueldoBase)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(result.netoAPagar)}</TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete employee?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove {emp.nombre} ({emp.id}) from the system. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => {
                                removeEmployee.mutate(emp.id, {
                                  onSuccess: () => toast.success("Employee removed"),
                                  onError: (err: any) => toast.error(err.message),
                                });
                              }}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Showing {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length}</span>
          <span className="mx-2">|</span>
          <span>Rows per page:</span>
          <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="w-[70px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={safePage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Button
              key={p}
              variant={p === safePage ? "default" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(p)}
            >
              {p}
            </Button>
          ))}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={safePage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
