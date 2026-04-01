import { useState, useRef } from "react";
import { useEmployees, useAddEmployee, useAddEmployeesBulk, useRemoveEmployee, useActivePeriod, usePayrollRecords, recordToConfig } from "@/hooks/useSupabasePayroll";
import { calcularNomina, type Employee, type Turno } from "@/types/payroll";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Upload, Plus, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const fmt = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export default function Empleados() {
  const { data: employees = [], isLoading } = useEmployees();
  const { data: activePeriod } = useActivePeriod();
  const { data: records = [] } = usePayrollRecords(activePeriod?.id);
  const addEmployee = useAddEmployee();
  const addEmployeesBulk = useAddEmployeesBulk();
  const removeEmployee = useRemoveEmployee();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const [form, setForm] = useState<Omit<Employee, "_uuid"> & { id: string }>({
    id: "",
    nombre: "",
    sueldoBase: 0,
    descuentoPorDia: 0,
    kpiMonto: 0,
    turno: "Lunes-Viernes" as Turno,
  });

  const filtered = employees.filter(
    (e) =>
      e.nombre.toLowerCase().includes(search.toLowerCase()) ||
      e.id.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (!form.id || !form.nombre) {
      toast.error("ID y Nombre son requeridos");
      return;
    }
    if (employees.find((e) => e.id === form.id)) {
      toast.error("Ya existe un empleado con ese ID");
      return;
    }
    addEmployee.mutate(form, {
      onSuccess: () => {
        toast.success("Empleado agregado correctamente");
        setAddOpen(false);
        setForm({ id: "", nombre: "", sueldoBase: 0, descuentoPorDia: 0, kpiMonto: 0, turno: "Lunes-Viernes" });
      },
      onError: (err: any) => toast.error(err.message || "Error al agregar empleado"),
    });
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
            turno: "Lunes-Viernes",
          });
        }
      }
      if (emps.length) {
        addEmployeesBulk.mutate(emps, {
          onSuccess: () => toast.success(`${emps.length} empleados importados`),
          onError: (err: any) => toast.error(err.message || "Error al importar"),
        });
      } else {
        toast.error("No se encontraron registros válidos");
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">Gestión de Empleados</h2>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSV} />
          <Button variant="outline" onClick={() => {
            const header = "ID,Nombre,SueldoBase,DescuentoPorDia,KPI";
            const example = "EMP001,Juan Pérez,15000,500,1000";
            const blob = new Blob([header + "\n" + example + "\n"], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "plantilla_empleados.csv";
            a.click();
            URL.revokeObjectURL(url);
          }}>
            <Download className="mr-2 h-4 w-4" /> Plantilla CSV
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> Cargar CSV
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nuevo Empleado</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Agregar Empleado</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>ID</Label>
                  <Input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Nombre</Label>
                  <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Sueldo Base Mensual</Label>
                  <Input type="number" value={form.sueldoBase || ""} onChange={(e) => setForm({ ...form, sueldoBase: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="grid gap-2">
                  <Label>Descuento por Día Faltado</Label>
                  <Input type="number" value={form.descuentoPorDia || ""} onChange={(e) => setForm({ ...form, descuentoPorDia: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="grid gap-2">
                  <Label>KPI (Monto Extra)</Label>
                  <Input type="number" value={form.kpiMonto || ""} onChange={(e) => setForm({ ...form, kpiMonto: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="grid gap-2">
                  <Label>Turno</Label>
                  <Select value={form.turno} onValueChange={(v) => setForm({ ...form, turno: v as Turno })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Lunes-Jueves">Lunes-Jueves</SelectItem>
                      <SelectItem value="Lunes-Viernes">Lunes-Viernes</SelectItem>
                      <SelectItem value="Viernes-Domingo">Viernes-Domingo</SelectItem>
                      <SelectItem value="Viernes-Lunes">Viernes-Lunes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAdd} disabled={addEmployee.isPending}>
                  {addEmployee.isPending ? "Guardando..." : "Agregar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nombre o ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Turno</TableHead>
                <TableHead className="text-right">Sueldo Base</TableHead>
                <TableHead className="text-right">Neto Quincenal</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No hay empleados registrados
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((emp) => {
                  const rec = records.find((r: any) => r.employee_id === emp._uuid);
                  const config = recordToConfig(rec, emp.id);
                  const result = calcularNomina(emp, config);
                  return (
                    <TableRow key={emp.id} className="cursor-pointer" onClick={() => navigate(`/empleados/${emp.id}`)}>
                      <TableCell className="font-medium">{emp.id}</TableCell>
                      <TableCell>{emp.nombre}</TableCell>
                      <TableCell className="text-muted-foreground">{emp.turno}</TableCell>
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
                              <AlertDialogTitle>¿Eliminar empleado?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Se eliminará a {emp.nombre} ({emp.id}) del sistema. Esta acción no se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => {
                                removeEmployee.mutate(emp.id, {
                                  onSuccess: () => toast.success("Empleado eliminado"),
                                  onError: (err: any) => toast.error(err.message),
                                });
                              }}>
                                Eliminar
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
    </div>
  );
}
