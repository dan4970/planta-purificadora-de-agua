import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Activity,
  ClipboardList,
  Clock,
  Gauge,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  daysUntil,
  formatDate,
  severityClass,
  severityLabel,
  statusClass,
  statusLabel,
  woStatusClass,
  woStatusLabel,
  woTypeLabel,
  type Asset,
  type PmPlan,
  type Reading,
  type Severity,
  type WorkOrder,
} from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({
    meta: [
      { title: "Panel de mantenimiento — AquaMant" },
      {
        name: "description",
        content: "Indicadores de disponibilidad, alarmas de vibración y órdenes de trabajo.",
      },
      { property: "og:title", content: "Panel de mantenimiento — AquaMant" },
      {
        property: "og:description",
        content: "Estado general de la planta: alarmas, órdenes abiertas y preventivos vencidos.",
      },
    ],
  }),
  component: Panel,
});

function Panel() {
  const { data, isLoading } = useQuery({
    queryKey: ["panel"],
    queryFn: async () => {
      const [assets, orders, plans, readings] = await Promise.all([
        supabase.from("assets").select("*").order("code"),
        supabase.from("work_orders").select("*").order("opened_at", { ascending: false }),
        supabase.from("pm_plans").select("*").order("next_due_at"),
        supabase
          .from("vibration_readings")
          .select("*")
          .order("measured_at", { ascending: false })
          .limit(600),
      ]);
      return {
        assets: (assets.data ?? []) as Asset[],
        orders: (orders.data ?? []) as WorkOrder[],
        plans: (plans.data ?? []) as unknown as PmPlan[],
        readings: (readings.data ?? []) as Reading[],
      };
    },
  });

  if (isLoading || !data) {
    return (
      <AppShell title="Panel" subtitle="Cargando indicadores…">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </AppShell>
    );
  }

  const { assets, orders, plans, readings } = data;
  const assetById = new Map(assets.map((a) => [a.id, a]));

  const openOrders = orders.filter((o) => !["cerrada", "cancelada"].includes(o.status));
  const overdueOrders = openOrders.filter((o) => o.due_date && daysUntil(o.due_date) < 0);
  const alarmAssets = assets.filter((a) => a.status === "alarma");
  const duePlans = plans.filter((p) => p.active && daysUntil(p.next_due_at) < 0);
  const upcomingPlans = plans
    .filter((p) => p.active && daysUntil(p.next_due_at) >= 0)
    .slice(0, 6);

  const closed = orders.filter((o) => o.status === "cerrada" && o.closed_at);
  const mttr = closed.length
    ? closed.reduce((sum, o) => sum + Number(o.downtime_hours || 0), 0) / closed.length
    : 0;
  const correctives = orders.filter((o) => o.type === "correctivo").length;
  const mtbf = correctives ? (90 * 24) / correctives : 0;
  const totalDowntime = orders.reduce((s, o) => s + Number(o.downtime_hours || 0), 0);
  const availability = Math.max(
    0,
    100 - (totalDowntime / (assets.length * 90 * 24)) * 100,
  ).toFixed(2);

  // Última lectura por punto, para el semáforo de equipos críticos
  const latestByPoint = new Map<string, Reading>();
  for (const r of readings) {
    if (!latestByPoint.has(r.measurement_point_id)) latestByPoint.set(r.measurement_point_id, r);
  }
  const worstBySeverity: Record<Severity, number> = {
    bueno: 0,
    aceptable: 0,
    alerta: 0,
    peligro: 0,
  };
  for (const r of latestByPoint.values()) worstBySeverity[r.severity] += 1;

  const kpis = [
    {
      label: "Equipos en alarma",
      value: alarmAssets.length,
      icon: AlertTriangle,
      tone: alarmAssets.length ? "text-danger" : "text-good",
    },
    { label: "Órdenes abiertas", value: openOrders.length, icon: ClipboardList, tone: "text-primary" },
    {
      label: "Preventivos vencidos",
      value: duePlans.length,
      icon: Gauge,
      tone: duePlans.length ? "text-alert" : "text-good",
    },
    { label: "Disponibilidad", value: `${availability}%`, icon: TrendingUp, tone: "text-good" },
  ];

  return (
    <AppShell
      title="Panel de mantenimiento"
      subtitle="Estado general de la planta purificadora"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</p>
                <p className="mt-2 text-3xl font-semibold">{k.value}</p>
              </div>
              <k.icon className={`h-8 w-8 ${k.tone}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Indicadores de gestión</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="MTTR (horas de paro por reparación)" value={mttr.toFixed(1)} />
            <Row label="MTBF estimado (horas entre fallas)" value={mtbf.toFixed(0)} />
            <Row label="Órdenes atrasadas" value={String(overdueOrders.length)} />
            <Row label="Horas de paro acumuladas" value={totalDowntime.toFixed(1)} />
            <Row label="Equipos registrados" value={String(assets.length)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" /> Vibración — puntos por estado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(Object.keys(worstBySeverity) as Severity[]).map((s) => (
              <div key={s} className="flex items-center justify-between">
                <Badge variant="outline" className={severityClass[s]}>
                  {severityLabel[s]}
                </Badge>
                <span className="text-lg font-semibold">{worstBySeverity[s]}</span>
              </div>
            ))}
            <Link
              to="/predictivo"
              className="mt-2 inline-block text-sm text-primary hover:underline"
            >
              Ver tendencias y diagnósticos →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-danger" /> Equipos que requieren atención
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alarmAssets.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin equipos en alarma.</p>
            )}
            {alarmAssets.map((a) => (
              <Link
                key={a.id}
                to="/activos/$id"
                params={{ id: a.id }}
                className="block rounded-sm border border-border p-3 transition-colors hover:border-primary/60"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{a.name}</span>
                  <Badge variant="outline" className={statusClass[a.status]}>
                    {statusLabel[a.status]}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {a.code} · {a.area}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4 text-primary" /> Órdenes abiertas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {openOrders.slice(0, 7).map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    OT-{o.wo_number} · {o.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {assetById.get(o.asset_id)?.name ?? "—"} · {woTypeLabel[o.type]}
                  </p>
                </div>
                <Badge variant="outline" className={woStatusClass[o.status]}>
                  {woStatusLabel[o.status]}
                </Badge>
              </div>
            ))}
            {openOrders.length === 0 && (
              <p className="text-sm text-muted-foreground">No hay órdenes abiertas.</p>
            )}
            <Link to="/ordenes" className="inline-block pt-1 text-sm text-primary hover:underline">
              Ver todas las órdenes →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-alert" /> Plan preventivo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {duePlans.slice(0, 4).map((p) => (
              <div key={p.id} className="rounded-sm border border-danger/40 bg-danger/10 p-3">
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-danger">
                  Vencido hace {Math.abs(daysUntil(p.next_due_at))} días
                </p>
              </div>
            ))}
            {upcomingPlans.map((p) => (
              <div key={p.id} className="rounded-sm border border-border p-3">
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  Próxima: {formatDate(p.next_due_at)} ({daysUntil(p.next_due_at)} días)
                </p>
              </div>
            ))}
            <Link
              to="/preventivo"
              className="inline-block pt-1 text-sm text-primary hover:underline"
            >
              Ver calendario preventivo →
            </Link>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  );
}
