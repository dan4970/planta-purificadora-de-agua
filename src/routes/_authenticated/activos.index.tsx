import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  criticalityLabel,
  statusClass,
  statusLabel,
  type Asset,
  type Criticality,
} from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/activos/")({
  head: () => ({
    meta: [
      { title: "Equipos de la planta — AquaMant" },
      {
        name: "description",
        content: "Inventario de equipos de tratamiento y embotellado con criticidad y estado.",
      },
      { property: "og:title", content: "Equipos de la planta — AquaMant" },
      {
        property: "og:description",
        content: "Ficha, criticidad, ubicación e historial de cada equipo de la planta.",
      },
    ],
  }),
  component: Activos,
});

function Activos() {
  const { isStaff } = useCurrentUser();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("todas");
  const [open, setOpen] = useState(false);

  const { data: assets, isLoading } = useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assets").select("*").order("code");
      if (error) throw error;
      return data as Asset[];
    },
  });

  const create = useMutation({
    mutationFn: async (form: {
      code: string;
      name: string;
      area: string;
      criticality: Criticality;
      location: string;
    }) => {
      const { error } = await supabase.from("assets").insert(form);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Equipo agregado");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (e: Error) => toast.error("No se pudo guardar", { description: e.message }),
  });

  const areas = Array.from(new Set((assets ?? []).map((a) => a.area)));
  const filtered = (assets ?? []).filter((a) => {
    const matchArea = area === "todas" || a.area === area;
    const q = search.trim().toLowerCase();
    const matchText =
      !q || a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q);
    return matchArea && matchText;
  });

  return (
    <AppShell
      title="Equipos"
      subtitle={`${assets?.length ?? 0} equipos registrados`}
      actions={
        isStaff && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Nuevo equipo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo equipo</DialogTitle>
                <DialogDescription>
                  Registrá un equipo del proceso o de la línea de embotellado.
                </DialogDescription>
              </DialogHeader>
              <form
                id="asset-form"
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  create.mutate({
                    code: String(fd.get("code")),
                    name: String(fd.get("name")),
                    area: String(fd.get("area")),
                    criticality: String(fd.get("criticality")) as Criticality,
                    location: String(fd.get("location")),
                  });
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="code">Código</Label>
                    <Input id="code" name="code" required placeholder="TR-013" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="area">Área</Label>
                    <Input id="area" name="area" required defaultValue="Tratamiento" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del equipo</Label>
                  <Input id="name" name="name" required />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="criticality">Criticidad</Label>
                    <select
                      id="criticality"
                      name="criticality"
                      defaultValue="importante"
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="critico">Crítico</option>
                      <option value="importante">Importante</option>
                      <option value="general">General</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Ubicación</Label>
                    <Input id="location" name="location" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={create.isPending}>
                    Guardar equipo
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )
      }
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o código"
            className="pl-9"
          />
        </div>
        <Select value={area} onValueChange={setArea}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Área" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las áreas</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Criticidad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Horas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id} className="cursor-pointer">
                  <TableCell className="font-mono text-xs">{a.code}</TableCell>
                  <TableCell>
                    <Link
                      to="/activos/$id"
                      params={{ id: a.id }}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {a.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{a.location}</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.area}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        a.criticality === "critico"
                          ? "border-danger/50 bg-danger/15 text-danger"
                          : a.criticality === "importante"
                            ? "border-acceptable/40 bg-acceptable/15 text-acceptable"
                            : "border-border bg-muted text-muted-foreground"
                      }
                    >
                      {criticalityLabel[a.criticality]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusClass[a.status]}>
                      {statusLabel[a.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {Number(a.service_hours).toLocaleString("es-AR")}
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
