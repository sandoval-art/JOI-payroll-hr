import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarDays, Check, X } from "lucide-react";

interface TimeOffRequest {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  notes: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  employees: {
    full_name: string;
  } | null;
}

const reasonMap: { [key: string]: string } = {
  vacation: "Vacaciones",
  sick: "Enfermedad",
  personal: "Personal",
  other: "Otro",
};

const statusBadgeColor = (status: string) => {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "approved":
      return "bg-green-100 text-green-800";
    case "denied":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const statusLabel = (status: string) => {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "approved":
      return "Aprobado";
    case "denied":
      return "Rechazado";
    default:
      return status;
  }
};

export default function TimeOff() {
  const { user, employeeId, role } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    reason: "vacation",
    notes: "",
  });

  // Fetch employee's time off requests
  const { data: myRequests = [] } = useQuery({
    queryKey: ["timeOffRequests", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from("time_off_requests")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as TimeOffRequest[];
    },
    enabled: !!employeeId,
  });

  // Fetch pending requests (for managers/admins)
  const { data: pendingRequests = [] } = useQuery({
    queryKey: ["pendingTimeOffRequests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_off_requests")
        .select("*, employees(full_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as TimeOffRequest[];
    },
    enabled: role === "manager" || role === "admin",
  });

  // Fetch all reviewed requests (for managers/admins)
  const { data: reviewedRequests = [] } = useQuery({
    queryKey: ["reviewedTimeOffRequests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_off_requests")
        .select("*, employees(full_name)")
        .in("status", ["approved", "denied"])
        .order("reviewed_at", { ascending: false });

      if (error) throw error;
      return (data || []) as TimeOffRequest[];
    },
    enabled: role === "manager" || role === "admin",
  });

  // Submit time off request
  const submitRequestMutation = useMutation({
    mutationFn: async () => {
      if (!employeeId || !formData.startDate || !formData.endDate) {
        throw new Error("Faltan campos requeridos");
      }

      const { data, error } = await supabase
        .from("time_off_requests")
        .insert([
          {
            employee_id: employeeId,
            start_date: formData.startDate,
            end_date: formData.endDate,
            reason: formData.reason,
            notes: formData.notes || null,
            status: "pending",
          },
        ])
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeOffRequests", employeeId] });
      setFormData({ startDate: "", endDate: "", reason: "vacation", notes: "" });
    },
  });

  // Approve request
  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from("time_off_requests")
        .update({
          status: "approved",
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingTimeOffRequests"] });
      queryClient.invalidateQueries({ queryKey: ["reviewedTimeOffRequests"] });
    },
  });

  // Deny request
  const denyMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from("time_off_requests")
        .update({
          status: "denied",
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingTimeOffRequests"] });
      queryClient.invalidateQueries({ queryKey: ["reviewedTimeOffRequests"] });
    },
  });

  const isEmployee = role === "employee";
  const isManagerOrAdmin = role === "manager" || role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Solicitudes de Tiempo Libre</h1>
        <p className="text-muted-foreground mt-2">
          {isEmployee
            ? "Solicita y gestiona tu tiempo libre"
            : "Revisa y aprueba solicitudes de tiempo libre"}
        </p>
      </div>

      {/* Employee form - shown for employees and managers who have an employeeId */}
      {(isEmployee || (isManagerOrAdmin && employeeId)) && (
        <Card>
          <CardHeader>
            <CardTitle>Nueva Solicitud de Tiempo Libre</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Fecha de Inicio</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Fecha de Fin</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData({ ...formData, endDate: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Motivo</Label>
                <Select value={formData.reason} onValueChange={(value) => setFormData({ ...formData, reason: value })}>
                  <SelectTrigger id="reason">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vacation">Vacaciones</SelectItem>
                    <SelectItem value="sick">Enfermedad</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas (opcional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Información adicional..."
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  className="min-h-24"
                />
              </div>

              <Button
                onClick={() => submitRequestMutation.mutate()}
                disabled={submitRequestMutation.isPending || !formData.startDate || !formData.endDate}
                className="w-full"
              >
                Enviar Solicitud
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employee view - my requests */}
      {isEmployee && (
        <Card>
          <CardHeader>
            <CardTitle>Mis Solicitudes</CardTitle>
          </CardHeader>
          <CardContent>
            {myRequests.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No tienes solicitudes de tiempo libre
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fechas</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha Solicitud</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="w-4 h-4" />
                            {new Date(request.start_date).toLocaleDateString("es-ES")} -{" "}
                            {new Date(request.end_date).toLocaleDateString("es-ES")}
                          </div>
                        </TableCell>
                        <TableCell>{reasonMap[request.reason] || request.reason}</TableCell>
                        <TableCell>
                          <Badge className={statusBadgeColor(request.status)}>
                            {statusLabel(request.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(request.created_at).toLocaleDateString("es-ES")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Manager/Admin view - pending requests */}
      {isManagerOrAdmin && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Solicitudes Pendientes</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingRequests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No hay solicitudes pendientes
                </p>
              ) : (
                <div className="space-y-4">
                  {pendingRequests.map((request) => (
                    <Card key={request.id} className="border">
                      <CardContent className="pt-6">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold">
                                {request.employees?.full_name || "Empleado desconocido"}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(request.start_date).toLocaleDateString("es-ES")} -{" "}
                                {new Date(request.end_date).toLocaleDateString("es-ES")}
                              </p>
                            </div>
                            <Badge variant="secondary">
                              {reasonMap[request.reason] || request.reason}
                            </Badge>
                          </div>

                          {request.notes && (
                            <p className="text-sm text-muted-foreground italic">
                              {request.notes}
                            </p>
                          )}

                          <p className="text-xs text-muted-foreground">
                            Solicitado: {new Date(request.created_at).toLocaleDateString("es-ES")}
                          </p>

                          <div className="flex gap-2 pt-2">
                            <Button
                              onClick={() => approveMutation.mutate(request.id)}
                              disabled={approveMutation.isPending || denyMutation.isPending}
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                              size="sm"
                            >
                              <Check className="w-4 h-4 mr-2" />
                              Aprobar
                            </Button>
                            <Button
                              onClick={() => denyMutation.mutate(request.id)}
                              disabled={approveMutation.isPending || denyMutation.isPending}
                              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                              variant="destructive"
                              size="sm"
                            >
                              <X className="w-4 h-4 mr-2" />
                              Rechazar
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Manager/Admin view - history */}
          <Card>
            <CardHeader>
              <CardTitle>Historial de Solicitudes</CardTitle>
            </CardHeader>
            <CardContent>
              {reviewedRequests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No hay solicitudes revisadas
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Empleado</TableHead>
                        <TableHead>Fechas</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Revisado por</TableHead>
                        <TableHead>Fecha Revisión</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reviewedRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="font-medium">
                            {request.employees?.full_name || "Desconocido"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <CalendarDays className="w-4 h-4" />
                              {new Date(request.start_date).toLocaleDateString("es-ES")} -{" "}
                              {new Date(request.end_date).toLocaleDateString("es-ES")}
                            </div>
                          </TableCell>
                          <TableCell>
                            {reasonMap[request.reason] || request.reason}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusBadgeColor(request.status)}>
                              {statusLabel(request.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {request.reviewed_by ? (
                              <span className="text-muted-foreground">
                                ID: {request.reviewed_by.substring(0, 8)}...
                              </span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {request.reviewed_at
                              ? new Date(request.reviewed_at).toLocaleDateString("es-ES")
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
