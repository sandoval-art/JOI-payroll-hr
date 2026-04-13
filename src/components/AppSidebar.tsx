import {
  LayoutDashboard,
  Users,
  History,
  LogOut,
  FileText,
  Clock,
  BarChart3,
  CalendarDays,
  Timer,
  ClipboardCheck,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const adminItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Employees", url: "/empleados", icon: Users },
  { title: "Payroll History", url: "/historial", icon: History },
  { title: "Invoices (USD)", url: "/facturas", icon: FileText },
];

const hrItems = [
  { title: "Attendance", url: "/asistencia", icon: Clock },
  { title: "Performance", url: "/desempeno", icon: BarChart3 },
  { title: "Time Off Requests", url: "/solicitudes", icon: CalendarDays },
  { title: "My Timeclock", url: "/reloj", icon: Timer },
  { title: "My EOD", url: "/eod", icon: ClipboardCheck },
];

const managerItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Attendance", url: "/asistencia", icon: Clock },
  { title: "Performance", url: "/desempeno", icon: BarChart3 },
  { title: "Time Off Requests", url: "/solicitudes", icon: CalendarDays },
  { title: "My Timeclock", url: "/reloj", icon: Timer },
  { title: "My EOD", url: "/eod", icon: ClipboardCheck },
];

const employeeItems = [
  { title: "My Timeclock", url: "/reloj", icon: Timer },
  { title: "My EOD", url: "/eod", icon: ClipboardCheck },
  { title: "My Requests", url: "/solicitudes", icon: CalendarDays },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { signOut, user, role, isAdmin, isManager, isEmployee } = useAuth();
  const collapsed = state === "collapsed";

  // Determine which items to show based on role
  let mainItems = [];
  let showHRSection = false;

  if (isAdmin) {
    mainItems = adminItems;
    showHRSection = true;
  } else if (isManager) {
    mainItems = managerItems;
  } else if (isEmployee) {
    mainItems = employeeItems;
  }

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <span className="text-sidebar-primary-foreground font-bold text-sm">JH</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-sidebar-foreground">JOI HR</h2>
              <p className="text-xs text-sidebar-foreground/60">Admin System</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center mx-auto">
            <span className="text-sidebar-primary-foreground font-bold text-sm">J</span>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {showHRSection && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/50">Human Resources</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {hrItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-2">
        {!collapsed && user && (
          <p className="text-xs text-sidebar-foreground/50 px-2 mb-1 truncate">{user.email}</p>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} className="hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              {!collapsed && <span>Sign Out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
