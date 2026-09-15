import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatDate,
  priorityClass,
  priorityLabel,
  woStatusClass,
  woStatusLabel,
  woTypeLabel,
  type Asset,
  type WorkOrder,
  type WoPriority,
  type WoStatus,
  type WoType,
} from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/ordenes")({
  head: () => ({
    meta: [
      { title: "Órdenes de trabajo — AquaMant" },
      {
        name: "description",
        content:
          "Alta y seguimiento de órdenes correctivas, preventivas y predictivas de la planta.",
      },
      { property: "og:title", content: "Órdenes de trabajo — AquaMant" },
      {
        property: "og:description",
        content: "Estado, prioridad, técnico asignado y horas de paro de cada orden.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Ordenes;
});

function Ordenes() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("todas");
  const [type, setType] = useState("todos");
  const [openNew, setOpenNew] = useState(false);
  const [detail, setDetail] = useState<WorkOrder | null>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["work-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("*")
        .order("wo_number", { ascending: false });
      if (error) throw error;
      return data as WorkOrder[];
    },
  });

  const { data: assets } = useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assets").select("*").order("code");
      if (error) throw error;
      return data as Asset[];
    },
  });

  const assetName = (id: string) => {
    const a = assets?.find((x) => x.id === id);
    return a ? `${a.code} · ${a.name}` : "—";
  };

  const create = useMutation({
    mutationFn: async (form: Record<string, unknown>) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("work_orders")
        .insert({ ...form, created_by: auth.user?.id } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Orden creada");
      setOpenNew(false);
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
    },
    onError: (e: Error) => toast.error("No se pudo crear", { description: e.message }),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("work_orders")
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Orden actualizada");
      setDetail(null);
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (e: Error) => toast.error("No se pudo guardar", { description: e.message }),
  });

  const filtered = (orders ?? []).filter(
    (o) => (status === "todas" || o.status === status) && (type === "todos" || o.type === type),
  );

  return (
    <AppShell
      title="Órdenes de trabajo"
      subtitle={`${filtered.length} órdenes visibles`}
      actions={
        <Button onClick={() => setOpenNew(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nueva orden
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos los estados</SelectItem>
            {Object.entries(woStatusLabel).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            {Object.entries(woTypeLabel).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
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
                <TableHead>N°</TableHead>
                <TableHead>Equipo</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Apertura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => (
                <TableRow
                  key={o.id}
                  className="cursor-pointer"
                  onClick={() => setDetail(o)}
                >
                  <TableCell className="font-mono text-xs">#{o.wo_number}</TableCell>
                  <TableCell className="text-sm">{assetName(o.asset_id)}</TableCell>
                  <TableCell className="font-medium">{o.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {woTypeLabel[o.type]}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={priorityClass[o.priority]}>
                      {priorityLabel[o.priority]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={woStatusClass[o.status]}>
                      {woStatusLabel[o.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(o.opened_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva orden de trabajo</DialogTitle>
            <DialogDescription>Registrá una falla o un trabajo programado.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              create.mutate({
                asset_id: String(fd.get("asset_id")),
                title: String(fd.get("title")),
                type: String(fd.get("type")) as WoType,
                priority: String(fd.get("priority")) as WoPriority,
                symptom: String(fd.get("symptom")) || null,
                description: String(fd.get("description")) || null,
                due_date: String(fd.get("due_date")) || null,
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="asset_id">Equipo</Label>
              <select
                id="asset_id"
                name="asset_id"
                required
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {(assets ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input id="title" name="title" required placeholder="Ruido en rodamiento lado motor" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <select
                  id="type"
                  name="type"
                  defaultValue="correctivo"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {Object.entries(woTypeLabel).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Prioridad</Label>
                <select
                  id="priority"
                  name="priority"
                  defaultValue="media"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {Object.entries(priorityLabel).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Fecha límite</Label>
                <Input id="due_date" name="due_date" type="date" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="symptom">Síntoma / falla observada</Label>
              <Textarea id="symptom" name="symptom" rows={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea id="description" name="description" rows={3} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                Crear orden
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Orden #{detail.wo_number} · {detail.title}
                </DialogTitle>
                <DialogDescription>{assetName(detail.asset_id)}</DialogDescription>
              </DialogHeader>
              <div className="space-y-1 rounded-md border border-border bg-muted/30 p-3 text-sm">
                <p>
                  <span className="text-muted-foreground">Síntoma: </span>
                  {detail.symptom || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Descripción: </span>
                  {detail.description || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Abierta: </span>
                  {formatDate(detail.opened_at)}
                </p>
              </div>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const nextStatus = String(fd.get("status")) as WoStatus;
                  update.mutate({
                    id: detail.id,
                    patch: {
                      status: nextStatus,
                      work_done: String(fd.get("work_done")) || null,
                      root_cause: String(fd.get("root_cause")) || null,
                      labor_hours: Number(fd.get("labor_hours") || 0),
                      downtime_hours: Number(fd.get("downtime_hours") || 0),
                      cost: Number(fd.get("cost") || 0),
                      closed_at:
                        nextStatus === "cerrada" ? new Date().toISOString() : detail.closed_at,
                    },
                  });
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="status">Estado</Label>
                  <select
                    id="status"
                    name="status"
                    defaultValue={detail.status}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {Object.entries(woStatusLabel).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="root_cause">Causa raíz</Label>
                  <Textarea
                    id="root_cause"
                    name="root_cause"
                    rows={2}
                    defaultValue={detail.root_cause ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="work_done">Trabajo realizado</Label>
                  <Textarea
                    id="work_done"
                    name="work_done"
                    rows={3}
                    defaultValue={detail.work_done ?? ""}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="labor_hours">Horas de trabajo</Label>
                    <Input
                      id="labor_hours"
                      name="labor_hours"
                      type="number"
                      step="0.5"
                      defaultValue={detail.labor_hours}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="downtime_hours">Horas de paro</Label>
                    <Input
                      id="downtime_hours"
                      name="downtime_hours"
                      type="number"
                      step="0.5"
                      defaultValue={detail.downtime_hours}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cost">Costo</Label>
                    <Input
                      id="cost"
                      name="cost"
                      type="number"
                      step="0.01"
                      defaultValue={detail.cost}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={update.isPending}>
                    Guardar cambios
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
