import { LayoutDashboard, Users, History, LogOut } from "lucide-react";
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

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Empleados", url: "/empleados", icon: Users },
  { title: "Historial de Nómina", url: "/historial", icon: History },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { signOut, user } = useAuth();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <span className="text-sidebar-primary-foreground font-bold text-sm">NP</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-sidebar-foreground">Nómina Pro</h2>
              <p className="text-xs text-sidebar-foreground/60">Sistema Administrativo</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center mx-auto">
            <span className="text-sidebar-primary-foreground font-bold text-sm">N</span>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">Menú</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
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
      </SidebarContent>
      <SidebarFooter className="p-2">
        {!collapsed && user && (
          <p className="text-xs text-sidebar-foreground/50 px-2 mb-1 truncate">{user.email}</p>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} className="hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              {!collapsed && <span>Cerrar Sesión</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
