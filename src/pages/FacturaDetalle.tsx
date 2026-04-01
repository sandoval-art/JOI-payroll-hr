import { useParams, useNavigate } from "react-router-dom";
import { useInvoice, useUpdateInvoiceStatus, fmtUSD } from "@/hooks/useInvoices";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Printer, Send, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const BILL_FROM = "JOI\n2886 Avenida Pablo Neruda\nProvidencia 4A Seccion\nGuadalajara, Jalisco, 44369";

const statusLabels: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviada",
  paid: "Pagada",
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-primary/15 text-primary",
  paid: "bg-green-100 text-green-700",
};

export default function FacturaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: invoice, isLoading } = useInvoice(id);
  const updateStatus = useUpdateInvoiceStatus();

  if (isLoading) {
    return <div className="py-20 text-center text-muted-foreground">Cargando...</div>;
  }

  if (!invoice) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground mb-4">Factura no encontrada</p>
        <Button variant="outline" onClick={() => navigate("/facturas")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
      </div>
    );
  }

  const lines = invoice.lines || [];
  const grandTotal = lines.reduce((sum, l) => sum + Number(l.total_price), 0);

  const handleStatusChange = (status: string) => {
    updateStatus.mutate(
      { id: invoice.id, status },
      {
        onSuccess: () =>
          toast.success(
            status === "sent" ? "Factura marcada como enviada" : "Factura marcada como pagada"
          ),
        onError: (err: any) => toast.error(err.message),
      }
    );
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={() => navigate("/facturas")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Facturas
        </Button>
        <div className="flex gap-2">
          {invoice.status === "draft" && (
            <Button
              variant="outline"
              onClick={() => handleStatusChange("sent")}
              disabled={updateStatus.isPending}
            >
              <Send className="mr-2 h-4 w-4" /> Marcar Enviada
            </Button>
          )}
          {invoice.status === "sent" && (
            <Button
              variant="outline"
              onClick={() => handleStatusChange("paid")}
              disabled={updateStatus.isPending}
            >
              <CheckCircle className="mr-2 h-4 w-4" /> Marcar Pagada
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir
          </Button>
        </div>
      </div>

      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-8">
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-3xl font-bold text-primary mb-1">INVOICE</h1>
              <p className="text-xl font-semibold">{invoice.invoice_number}</p>
              <Badge
                variant="secondary"
                className={`mt-2 ${statusColors[invoice.status] || ""} print:hidden`}
              >
                {statusLabels[invoice.status] || invoice.status}
              </Badge>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>Week {invoice.week_number}</p>
              <p>{invoice.week_start} — {invoice.week_end}</p>
              <p className="font-medium mt-1">Due: {invoice.due_date}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Bill From</p>
              <p className="text-sm whitespace-pre-line">{BILL_FROM}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Bill To</p>
              <p className="text-sm font-medium">{invoice.client?.bill_to_name || invoice.client?.name}</p>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {invoice.client?.bill_to_address || ""}
              </p>
            </div>
          </div>

          <Separator className="mb-6" />

          {/* Lines */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead className="text-right">Days Worked</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Spiffs</TableHead>
                <TableHead className="text-right">Total Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="font-medium">{line.agent_name}</TableCell>
                  <TableCell className="text-right">{Number(line.days_worked)}</TableCell>
                  <TableCell className="text-right">{fmtUSD(Number(line.unit_price))}</TableCell>
                  <TableCell className="text-right">{fmtUSD(Number(line.total))}</TableCell>
                  <TableCell className="text-right">{fmtUSD(Number(line.spiffs))}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {fmtUSD(Number(line.total_price))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Separator className="my-6" />

          <div className="flex justify-end">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Grand Total</p>
              <p className="text-3xl font-bold text-primary">{fmtUSD(grandTotal)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
