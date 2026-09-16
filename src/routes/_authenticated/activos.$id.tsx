import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  criticalityLabel,
  formatDate,
  formatDateTime,
  severityClass,
  severityLabel,
  statusClass,
  statusLabel,
  woStatusClass,
  woStatusLabel,
  woTypeLabel,
  type Asset,
  type MeasurementPoint,
  type PmPlan,
  type Reading,
  type WorkOrder,
} from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/activos/$id")({
  head: () => ({
    meta: [
      { title: "Ficha del equipo — AquaMant" },
      {
        name: "description",
        content:
          "Historial de fallas, plan preventivo y últimas mediciones de vibración del equipo.",
      },
      { property: "og:title", content: "Ficha del equipo — AquaMant" },
      {
        property: "og:description",
        content: "Estado, criticidad, órdenes e historial de mediciones del equipo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FichaEquipo,
});

function FichaEquipo() {
  const { id } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["asset-detail", id],
    queryFn: async () => {
      const [asset, orders, plans, points] = await Promise.all([
        supabase.from("assets").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("work_orders")
          .select("*")
          .eq("asset_id", id)
          .order("wo_number", { ascending: false }),
        supabase.from("pm_plans").select("*").eq("asset_id", id).order("next_due_at"),
        supabase.from("measurement_points").select("*").eq("asset_id", id).order("code"),
      ]);

      const pointIds = (points.data ?? []).map((p) => p.id);
      let readings: Reading[] = [];
      if (pointIds.length) {
        const { data: r } = await supabase
          .from("vibration_readings")
          .select("*")
          .in("measurement_point_id", pointIds)
          .order("measured_at", { ascending: false })
          .limit(20);
        readings = (r ?? []) as Reading[];
      }

      return {
        asset: asset.data as Asset | null,
        orders: (orders.data ?? []) as WorkOrder[],
        plans: (plans.data ?? []) as unknown as PmPlan[],
        points: (points.data ?? []) as MeasurementPoint[],
        readings,
      };
    },
  });

  const asset = data?.asset;

  return (
    <AppShell
      title={asset ? asset.name : "Ficha del equipo"}
      subtitle={asset ? `${asset.code} · ${asset.area}` : undefined}
      actions={
        <Button asChild variant="outline" size="sm">
          <Link to="/activos">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Link>
        </Button>
      }
    >
      {isLoading ? (
        <Skeleton className="h-96" />
      ) : !asset ? (
        <p className="text-sm text-muted-foreground">No se encontró el equipo.</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-normal text-muted-foreground">
                  Estado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="outline" className={statusClass[asset.status]}>
                  {statusLabel[asset.status]}
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-normal text-muted-foreground">
                  Criticidad
                </CardTitle>
              </CardHeader>
              <CardContent className="text-display text-xl">
                {criticalityLabel[asset.criticality]}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-normal text-muted-foreground">
                  Horas de servicio
                </CardTitle>
              </CardHeader>
              <CardContent className="text-display text-xl">
                {Number(asset.service_hours).toLocaleString("es-AR")}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-normal text-muted-foreground">
                  Ubicación
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">{asset.location ?? "—"}</CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-display text-base">Historial de órdenes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data!.orders.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin órdenes registradas.</p>
              )}
              {data!.orders.map((o) => (
                <div
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      #{o.wo_number} · {o.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {woTypeLabel[o.type]} · abierta {formatDate(o.opened_at)}
                    </p>
                  </div>
                  <Badge variant="outline" className={woStatusClass[o.status]}>
                    {woStatusLabel[o.status]}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-display text-base">Plan preventivo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data!.plans.length === 0 && (
                <p className="text-sm text-muted-foreground">Sin tareas programadas.</p>
              )}
              {data!.plans.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm"
                >
                  <span>{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    cada {p.frequency_value} {p.frequency_type} · próxima{" "}
                    {formatDate(p.next_due_at)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-display text-base">
                Últimas mediciones de vibración
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data!.readings.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Este equipo no tiene puntos de medición con lecturas.
                </p>
              )}
              {data!.readings.map((r) => {
                const point = data!.points.find((p) => p.id === r.measurement_point_id);
                return (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm"
                  >
                    <span className="font-mono text-xs">{point?.code ?? "—"}</span>
                    <span>{Number(r.velocity_rms).toFixed(2)} mm/s RMS</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(r.measured_at)}
                    </span>
                    <Badge variant="outline" className={severityClass[r.severity]}>
                      {severityLabel[r.severity]}
                    </Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
