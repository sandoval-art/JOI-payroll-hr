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
  ClipboardList,
  Settings,
  Building2,
  Calculator,
  UserCog,
  FileCheck,
  ScrollText,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { usePendingTimeOffCount } from "@/hooks/useTimeOffCount";
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

// Leadership (owner / admin / manager) — sees everything including pay
const leadershipItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Employees", url: "/empleados", icon: Users },
  { title: "Payroll Run", url: "/payroll-run", icon: Calculator },
  { title: "Payroll History", url: "/historial", icon: History },
  { title: "Invoices (USD)", url: "/facturas", icon: FileText },
  { title: "Campaigns", url: "/campaigns", icon: Building2 },
  { title: "My Policies", url: "/policies", icon: ScrollText },
];

const hrItems = [
  { title: "Attendance", url: "/asistencia", icon: Clock },
  { title: "Performance", url: "/desempeno", icon: BarChart3 },
  { title: "Time Off Requests", url: "/solicitudes", icon: CalendarDays },
  { title: "Document Types", url: "/settings/document-types", icon: FileCheck },
  { title: "Departments", url: "/settings/departments", icon: Building2 },
  { title: "Manage Policies", url: "/settings/policies", icon: ScrollText },
  { title: "Cartas y Actas", url: "/hr/document-queue", icon: ClipboardList },
  { title: "My Timeclock", url: "/reloj", icon: Timer },
  { title: "My EOD History", url: "/eod", icon: ClipboardCheck },
];

// Team Lead — team-scoped views, shift settings (their campaign), no pay
const teamLeadItems = [
  { title: "Home", url: "/", icon: LayoutDashboard },
  { title: "My Team", url: "/asistencia", icon: Users },
  { title: "Time Off Requests", url: "/solicitudes", icon: CalendarDays },
  { title: "Shift Settings", url: "/settings/shifts", icon: Settings },
  { title: "My Policies", url: "/policies", icon: ScrollText },
  { title: "My Timeclock", url: "/reloj", icon: Timer },
  { title: "My EOD History", url: "/eod", icon: ClipboardCheck },
];

// Agent — only their own stuff
const agentItems = [
  { title: "My Timeclock", url: "/reloj", icon: Timer },
  { title: "My EOD History", url: "/eod", icon: ClipboardCheck },
  { title: "My Policies", url: "/policies", icon: ScrollText },
  { title: "My Requests", url: "/solicitudes", icon: CalendarDays },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { signOut, user, isLeadership, isTeamLead, isAgent } = useAuth();
  const collapsed = state === "collapsed";

  // Sidebar badge counts (RLS scopes: leadership=all, TL=team, agent=0)
  const { data: pendingTimeOffCount = 0 } = usePendingTimeOffCount();

  const badgeCounts: Record<string, number> = {
    "/solicitudes": pendingTimeOffCount,
  };

  // Determine which items to show based on title
  let mainItems: { title: string; url: string; icon: typeof LayoutDashboard }[] = [];
  let showHRSection = false;

  if (isLeadership) {
    mainItems = leadershipItems;
    showHRSection = true;
  } else if (isTeamLead) {
    mainItems = teamLeadItems;
  } else if (isAgent) {
    mainItems = agentItems;
  }

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <img
              src="/joi-logo.svg"
              alt="JOI"
              className="h-10 w-auto select-none"
              draggable={false}
            />
            <div>
              <h2 className="text-sm font-bold tracking-tight text-sidebar-foreground">Payroll & HR</h2>
              <p className="text-[11px] uppercase tracking-widest text-sidebar-foreground/40 font-medium">Management</p>
            </div>
          </div>
        )}
        {collapsed && (
          <img
            src="/joi-favicon.svg"
            alt="JOI"
            className="h-8 w-8 mx-auto select-none"
            draggable={false}
          />
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-widest text-sidebar-foreground/30 font-medium">Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent relative"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && (
                        <span className="flex-1 flex items-center justify-between">
                          {item.title}
                          {(badgeCounts[item.url] ?? 0) > 0 && (
                            <span className="ml-auto inline-flex items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold leading-none text-destructive-foreground">
                              {badgeCounts[item.url]}
                            </span>
                          )}
                        </span>
                      )}
                      {collapsed && (badgeCounts[item.url] ?? 0) > 0 && (
                        <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-destructive w-4 h-4 text-[9px] font-bold text-destructive-foreground">
                          {badgeCounts[item.url]}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {showHRSection && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] uppercase tracking-widest text-sidebar-foreground/30 font-medium">Human Resources</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {hrItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
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
            <SidebarMenuButton asChild>
              <NavLink
                to="/account"
                className="hover:bg-sidebar-accent"
                activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
              >
                <UserCog className="mr-2 h-4 w-4" />
                {!collapsed && <span>My Account</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
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
