import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useCurrentUser } from "@/hooks/use-current-user";
import { setUserRole } from "@/lib/admin.functions";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, roleLabel, type AppRole } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuarios y roles — AquaMant" },
      {
        name: "description",
        content: "Gestión de accesos: administrador, supervisor y técnico de mantenimiento.",
      },
      { property: "og:title", content: "Usuarios y roles — AquaMant" },
      {
        property: "og:description",
        content: "Asignación de permisos del equipo de mantenimiento de la planta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Usuarios,
});

function Usuarios() {
  const { isAdmin } = useCurrentUser();
  const queryClient = useQueryClient();
  const assign = useServerFn(setUserRole);

  const { data, isLoading } = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const [{ data: profiles, error }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, phone, created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (error) throw error;
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? [])
          .filter((r) => r.user_id === p.id)
          .map((r) => r.role as AppRole),
      }));
    },
  });

  const change = useMutation({
    mutationFn: (vars: { userId: string; role: AppRole }) => assign({ data: vars }),
    onSuccess: () => {
      toast.success("Rol actualizado");
      queryClient.invalidateQueries({ queryKey: ["team"] });
      queryClient.invalidateQueries({ queryKey: ["current-user"] });
    },
    onError: (e: Error) => toast.error("No se pudo cambiar el rol", { description: e.message }),
  });

  return (
    <AppShell
      title="Usuarios"
      subtitle={
        isAdmin
          ? "Podés cambiar el rol de cada persona del equipo"
          : "Solo un administrador puede cambiar roles"
      }
    >
      {isLoading ? (
        <Skeleton className="h-72" />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Alta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <select
                        value={u.roles[0] ?? "tecnico"}
                        disabled={change.isPending}
                        onChange={(e) =>
                          change.mutate({
                            userId: u.id,
                            role: e.target.value as AppRole,
                          })
                        }
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {Object.entries(roleLabel).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Badge variant="outline">
                        {u.roles.map((r) => roleLabel[r]).join(", ") || "Sin rol"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(u.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}
