import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  Activity,
  ClipboardList,
  Cog,
  Droplets,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  Plug,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { roleLabel } from "@/lib/crm";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/panel", label: "Panel", icon: LayoutDashboard },
  { to: "/activos", label: "Equipos", icon: Cog },
  { to: "/ordenes", label: "Órdenes", icon: ClipboardList },
  { to: "/preventivo", label: "Preventivo", icon: Gauge },
  { to: "/predictivo", label: "Predictivo", icon: Activity },
  { to: "/usuarios", label: "Usuarios", icon: Users },
  { to: "/integracion", label: "Sensores", icon: Plug },
] as const;

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { user, roles } = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-60 shrink-0 border-r border-sidebar-border bg-sidebar transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
          <Droplets className="h-5 w-5 text-primary" />
          <span className="text-display text-lg font-semibold text-sidebar-foreground">
            AquaMant
          </span>
        </div>
        <nav className="space-y-1 p-3">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-sm px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{
                className:
                  "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary",
              }}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute inset-x-0 bottom-0 border-t border-sidebar-border p-4">
          <p className="truncate text-sm font-medium text-sidebar-foreground">
            {user?.fullName ?? user?.email ?? "Usuario"}
          </p>
          <p className="text-xs text-muted-foreground">
            {roles.map((r) => roleLabel[r]).join(", ") || "Sin rol asignado"}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 w-full justify-start px-2"
            onClick={signOut}
          >
            <LogOut className="mr-2 h-4 w-4" /> Salir
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-border bg-panel/95 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-display text-xl font-semibold leading-tight">{title}</h1>
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </header>
        <main className="min-w-0 flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
