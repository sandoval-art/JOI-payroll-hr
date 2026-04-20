import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { useAuth, AuthProvider } from "@/hooks/useAuth";
import Dashboard from "@/pages/Dashboard";
import EmployeeHome from "@/pages/EmployeeHome";
import Empleados from "@/pages/Empleados";
import EmpleadoPerfil from "@/pages/EmpleadoPerfil";
import Historial from "@/pages/Historial";
import Facturas from "@/pages/Facturas";
import FacturaNueva from "@/pages/FacturaNueva";
import FacturaDetalle from "@/pages/FacturaDetalle";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";
import Timeclock from "@/pages/Timeclock";
import EODForm from "@/pages/EODForm";
import TimeOff from "@/pages/TimeOff";
import Attendance from "@/pages/Attendance";
import Performance from "@/pages/Performance";
import ShiftSettings from "@/pages/ShiftSettings";
import Campaigns from "@/pages/Campaigns";
import CampaignDetail from "@/pages/CampaignDetail";
import PayrollRun from "@/pages/PayrollRun";
import TeamLeadHome from "@/pages/TeamLeadHome";
import TLDashboard from "@/pages/TLDashboard";
import Account from "@/pages/Account";
import DocumentTypes from "@/pages/DocumentTypes";
import Policies from "@/pages/Policies";
import MyPolicies from "@/pages/MyPolicies";
import { RequireLeadership, RequireTeamLeadOrAbove } from "@/components/RequireRole";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function RoleHome() {
  const { isLeadership, isTeamLead } = useAuth();
  if (isLeadership) return <Dashboard />;
  if (isTeamLead) return <TeamLeadHome />;
  return <EmployeeHome />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (session) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<RoleHome />} />
                    <Route path="/empleados" element={<RequireLeadership><Empleados /></RequireLeadership>} />
                    <Route path="/empleados/:id" element={<RequireTeamLeadOrAbove><EmpleadoPerfil /></RequireTeamLeadOrAbove>} />
                    <Route path="/historial" element={<RequireLeadership><Historial /></RequireLeadership>} />
                    <Route path="/facturas" element={<RequireLeadership><Facturas /></RequireLeadership>} />
                    <Route path="/facturas/nueva" element={<RequireLeadership><FacturaNueva /></RequireLeadership>} />
                    <Route path="/facturas/:id" element={<RequireLeadership><FacturaDetalle /></RequireLeadership>} />
                    <Route path="/reloj" element={<Timeclock />} />
                    <Route path="/eod" element={<EODForm />} />
                    <Route path="/solicitudes" element={<TimeOff />} />
                    <Route path="/asistencia" element={<RequireTeamLeadOrAbove><Attendance /></RequireTeamLeadOrAbove>} />
                    <Route path="/desempeno" element={<RequireTeamLeadOrAbove><Performance /></RequireTeamLeadOrAbove>} />
                    <Route path="/team-lead/dashboard" element={<RequireTeamLeadOrAbove><TLDashboard /></RequireTeamLeadOrAbove>} />
                    <Route path="/settings/shifts" element={<RequireTeamLeadOrAbove><ShiftSettings /></RequireTeamLeadOrAbove>} />
                    <Route path="/campaigns" element={<RequireLeadership><Campaigns /></RequireLeadership>} />
                    <Route path="/campaigns/:id" element={<RequireLeadership><CampaignDetail /></RequireLeadership>} />
                    <Route path="/payroll-run" element={<RequireLeadership><PayrollRun /></RequireLeadership>} />
                    <Route path="/settings/document-types" element={<RequireLeadership><DocumentTypes /></RequireLeadership>} />
                    <Route path="/settings/policies" element={<RequireLeadership><Policies /></RequireLeadership>} />
                    <Route path="/policies" element={<MyPolicies />} />
                    <Route path="/account" element={<Account />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </AppLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
