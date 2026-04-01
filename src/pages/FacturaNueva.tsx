import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useClients, useAgentsByClient, useCreateInvoice, fmtUSD } from "@/hooks/useInvoices";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface LineItem {
  agent_name: string;
  days_worked: number;
  unit_price: number;
  spiffs: number;
}

export default function FacturaNueva() {
  const navigate = useNavigate();
  const { data: clients = [] } = useClients();
  const [clientId, setClientId] = useState("");
  const [weekNumber, setWeekNumber] = useState<number>(getWeekNumber(new Date()));
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");
  const { data: agents = [] } = useAgentsByClient(clientId || undefined);
  const createInvoice = useCreateInvoice();

  const [lines, setLines] = useState<LineItem[]>([]);

  // When agents change, reset lines
  const agentKey = agents.map((a: any) => a.id).join(",");
  useMemo(() => {
    if (agents.length > 0) {
      setLines(
        agents.map((a: any) => ({
          agent_name: a.full_name,
          days_worked: 0,
          unit_price: 0,
          spiffs: 0,
        }))
      );
    } else {
      setLines([]);
    }
  }, [agentKey]);

  const selectedClient = clients.find((c) => c.id === clientId);

  const dueDate = weekEnd
    ? (() => {
        const d = new Date(weekEnd + "T12:00:00");
        d.setDate(d.getDate() + 4);
        return d.toISOString().split("T")[0];
      })()
    : "";

  const invoiceNumber = selectedClient
    ? `${selectedClient.prefix}-${weekNumber}`
    : "";

  const updateLine = (idx: number, field: keyof LineItem, value: number) => {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l))
    );
  };

  const grandTotal = lines.reduce(
    (sum, l) => sum + l.days_worked * l.unit_price + l.spiffs,
    0
  );

  const handleSave = (status: "draft" | "sent") => {
    if (!clientId || !weekStart || !weekEnd) {
      toast.error("Completa todos los campos del encabezado");
      return;
    }

    const invoiceLines = lines.map((l) => ({
      agent_name: l.agent_name,
      days_worked: l.days_worked,
      unit_price: l.unit_price,
      total: l.days_worked * l.unit_price,
      spiffs: l.spiffs,
      total_price: l.days_worked * l.unit_price + l.spiffs,
    }));

    createInvoice.mutate(
      {
        invoice: {
          client_id: clientId,
          invoice_number: invoiceNumber,
          week_number: weekNumber,
          week_start: weekStart,
          week_end: weekEnd,
          due_date: dueDate,
          status,
        },
        lines: invoiceLines,
      },
      {
        onSuccess: (inv) => {
          toast.success(
            status === "draft" ? "Borrador guardado" : "Factura enviada"
          );
          navigate(`/facturas/${inv.id}`);
        },
        onError: (err: any) => toast.error(err.message),
      }
    );
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <Button variant="ghost" onClick={() => navigate("/facturas")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Facturas
      </Button>

      <h2 className="text-2xl font-bold">Nueva Factura</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Encabezado</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-2">
            <Label>Cliente</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Semana #</Label>
            <Input
              type="number"
              min={1}
              max={53}
              value={weekNumber}
              onChange={(e) => setWeekNumber(parseInt(e.target.value) || 1)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Fecha Inicio</Label>
            <Input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Fecha Fin</Label>
            <Input
              type="date"
              value={weekEnd}
              onChange={(e) => setWeekEnd(e.target.value)}
            />
          </div>
          {invoiceNumber && (
            <div className="grid gap-2">
              <Label>Factura #</Label>
              <p className="text-lg font-bold text-primary">{invoiceNumber}</p>
            </div>
          )}
          {dueDate && (
            <div className="grid gap-2">
              <Label>Vencimiento</Label>
              <p className="text-sm text-muted-foreground">{dueDate}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {clientId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Líneas de Factura</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {lines.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No hay agentes asignados a este cliente. Asigna agentes desde el perfil de empleado.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agente</TableHead>
                    <TableHead className="w-28">Días Trabajados</TableHead>
                    <TableHead className="w-36">Precio Unitario (USD)</TableHead>
                    <TableHead className="w-28 text-right">Total</TableHead>
                    <TableHead className="w-32">Spiffs (USD)</TableHead>
                    <TableHead className="w-32 text-right">Total + Spiffs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, idx) => {
                    const total = line.days_worked * line.unit_price;
                    const totalPrice = total + line.spiffs;
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{line.agent_name}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={7}
                            step={0.5}
                            value={line.days_worked || ""}
                            onChange={(e) =>
                              updateLine(idx, "days_worked", parseFloat(e.target.value) || 0)
                            }
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={line.unit_price || ""}
                            onChange={(e) =>
                              updateLine(idx, "unit_price", parseFloat(e.target.value) || 0)
                            }
                            className="w-28"
                          />
                        </TableCell>
                        <TableCell className="text-right">{fmtUSD(total)}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={line.spiffs || ""}
                            onChange={(e) =>
                              updateLine(idx, "spiffs", parseFloat(e.target.value) || 0)
                            }
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {fmtUSD(totalPrice)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={5} className="text-right font-bold">
                      Grand Total
                    </TableCell>
                    <TableCell className="text-right font-bold text-lg text-primary">
                      {fmtUSD(grandTotal)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {clientId && lines.length > 0 && (
        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => handleSave("draft")}
            disabled={createInvoice.isPending}
          >
            Guardar Borrador
          </Button>
          <Button
            onClick={() => handleSave("sent")}
            disabled={createInvoice.isPending}
          >
            Marcar como Enviada
          </Button>
        </div>
      )}
    </div>
  );
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
