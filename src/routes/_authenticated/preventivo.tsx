import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarClock, CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Skeleton } from "@/components/ui/skeleton";
import { daysUntil, formatDate, type Asset, type PmPlan } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/preventivo")({
  head: () => ({
    meta: [
      { title: "Plan preventivo — AquaMant" },
      {
        name: "description",
        content:
          "Tareas preventivas programadas por equipo, con checklist y próxima fecha automática.",
      },
      { property: "og:title", content: "Plan preventivo — AquaMant" },
      {
        property: "og:description",
        content: "Vencidos, próximos y cumplidos del plan de mantenimiento preventivo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Preventivo,
});

interface PlanRow extends Omit<PmPlan, "checklist"> {
  checklist: unknown;
}

function toChecklist(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v));
  return [];
}

function Preventivo() {
  const { isStaff } = useCurrentUser();
  const queryClient = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [exec, setExec] = useState<PlanRow | null>(null);
  const [done, setDone] = useState<Record<number, boolean>>({});

  const { data: plans, isLoading } = useQuery({
    queryKey: ["pm-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pm_plans")
        .select("*")
        .order("next_due_at");
      if (error) throw error;
      return data as PlanRow[];
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
      const { error } = await supabase.from("pm_plans").insert(form as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plan creado");
      setOpenNew(false);
      queryClient.invalidateQueries({ queryKey: ["pm-plans"] });
    },
    onError: (e: Error) => toast.error("No se pudo guardar", { description: e.message }),
  });

  const execute = useMutation({
    mutationFn: async ({
      plan,
      notes,
      hours,
    }: {
      plan: PlanRow;
      notes: string;
      hours: number;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const items = toChecklist(plan.checklist).map((step, i) => ({
        step,
        ok: !!done[i],
      }));
      const { error } = await supabase.from("pm_executions").insert({
        pm_plan_id: plan.id,
        executed_by: auth.user?.id ?? null,
        notes: notes || null,
        hours_spent: hours,
        checklist_result: items,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarea registrada, se programó la próxima");
      setExec(null);
      setDone({});
      queryClient.invalidateQueries({ queryKey: ["pm-plans"] });
    },
    onError: (e: Error) => toast.error("No se pudo registrar", { description: e.message }),
  });

  const overdue = (plans ?? []).filter((p) => p.active && daysUntil(p.next_due_at) < 0);
  const soon = (plans ?? []).filter(
    (p) => p.active && daysUntil(p.next_due_at) >= 0 && daysUntil(p.next_due_at) <= 15,
  );
  const rest = (plans ?? []).filter((p) => p.active && daysUntil(p.next_due_at) > 15);

  function Group({ label, rows }: { label: string; rows: PlanRow[] }) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-display text-base">
            {label} <span className="text-muted-foreground">({rows.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Nada en esta categoría.</p>
          )}
          {rows.map((p) => {
            const d = daysUntil(p.next_due_at);
            return (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{assetName(p.asset_id)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cada {p.frequency_value} {p.frequency_type} · última{" "}
                    {formatDate(p.last_done_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={
                      d < 0
                        ? "border-danger/50 bg-danger/15 text-danger"
                        : d <= 15
                          ? "border-alert/40 bg-alert/15 text-alert"
                          : "border-good/40 bg-good/15 text-good"
                    }
                  >
                    <CalendarClock className="mr-1 h-3 w-3" />
                    {formatDate(p.next_due_at)}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setExec(p);
                      setDone({});
                    }}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Ejecutar
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  }

  return (
    <AppShell
      title="Plan preventivo"
      subtitle={`${overdue.length} vencidos · ${soon.length} próximos`}
      actions={
        isStaff && (
          <Button onClick={() => setOpenNew(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo plan
          </Button>
        )
      }
    >
      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="space-y-6">
          <Group label="Vencidos" rows={overdue} />
          <Group label="Próximos 15 días" rows={soon} />
          <Group label="Programados" rows={rest} />
        </div>
      )}

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo plan preventivo</DialogTitle>
            <DialogDescription>
              Definí la tarea, la frecuencia y los pasos del checklist (uno por línea).
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              create.mutate({
                asset_id: String(fd.get("asset_id")),
                name: String(fd.get("name")),
                description: String(fd.get("description")) || null,
                frequency_type: String(fd.get("frequency_type")),
                frequency_value: Number(fd.get("frequency_value")),
                estimated_hours: Number(fd.get("estimated_hours") || 1),
                next_due_at: new Date(String(fd.get("next_due_at"))).toISOString(),
                checklist: String(fd.get("checklist"))
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
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
              <Label htmlFor="name">Nombre de la tarea</Label>
              <Input id="name" name="name" required placeholder="Lubricación de rodamientos" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="frequency_type">Frecuencia por</Label>
                <select
                  id="frequency_type"
                  name="frequency_type"
                  defaultValue="dias"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="dias">Días</option>
                  <option value="horas">Horas de operación</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="frequency_value">Cada</Label>
                <Input
                  id="frequency_value"
                  name="frequency_value"
                  type="number"
                  min="1"
                  defaultValue={30}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimated_hours">Horas estimadas</Label>
                <Input
                  id="estimated_hours"
                  name="estimated_hours"
                  type="number"
                  step="0.5"
                  defaultValue={1}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="next_due_at">Primera fecha</Label>
              <Input
                id="next_due_at"
                name="next_due_at"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checklist">Checklist (un paso por línea)</Label>
              <Textarea id="checklist" name="checklist" rows={4} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea id="description" name="description" rows={2} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                Guardar plan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!exec}
        onOpenChange={(v) => {
          if (!v) {
            setExec(null);
            setDone({});
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          {exec && (
            <>
              <DialogHeader>
                <DialogTitle>{exec.name}</DialogTitle>
                <DialogDescription>{assetName(exec.asset_id)}</DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  execute.mutate({
                    plan: exec,
                    notes: String(fd.get("notes")),
                    hours: Number(fd.get("hours_spent") || 0),
                  });
                }}
              >
                <div className="space-y-2">
                  <Label>Checklist</Label>
                  <div className="space-y-2 rounded-md border border-border p-3">
                    {toChecklist(exec.checklist).length === 0 && (
                      <p className="text-sm text-muted-foreground">Sin pasos definidos.</p>
                    )}
                    {toChecklist(exec.checklist).map((step, i) => (
                      <label key={i} className="flex items-start gap-2 text-sm">
                        <Checkbox
                          checked={!!done[i]}
                          onCheckedChange={(v) =>
                            setDone((prev) => ({ ...prev, [i]: v === true }))
                          }
                        />
                        <span>{step}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hours_spent">Horas empleadas</Label>
                  <Input
                    id="hours_spent"
                    name="hours_spent"
                    type="number"
                    step="0.5"
                    defaultValue={exec.estimated_hours}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Observaciones</Label>
                  <Textarea id="notes" name="notes" rows={3} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={execute.isPending}>
                    Registrar ejecución
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
