import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatDateTime,
  severityClass,
  severityDot,
  severityLabel,
  type Asset,
  type MeasurementPoint,
  type Reading,
  type Threshold,
} from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/predictivo")({
  head: () => ({
    meta: [
      { title: "Análisis de vibración — AquaMant" },
      {
        name: "description",
        content:
          "Tendencias de vibración, semáforo ISO 10816 y diagnóstico del estado de los equipos críticos.",
      },
      { property: "og:title", content: "Análisis de vibración — AquaMant" },
      {
        property: "og:description",
        content: "Velocidad RMS, aceleración, temperatura y RPM por punto de medición.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Predictivo,
});

const faultTypes = [
  "Desbalanceo",
  "Desalineación",
  "Rodamiento dañado",
  "Holgura mecánica",
  "Cavitación",
  "Eje flexionado",
  "Problema eléctrico",
];

function Predictivo() {
  const queryClient = useQueryClient();
  const [assetId, setAssetId] = useState<string>("");
  const [pointId, setPointId] = useState<string>("");

  const { data: assets } = useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assets").select("*").order("code");
      if (error) throw error;
      return data as Asset[];
    },
  });

  const { data: points } = useQuery({
    queryKey: ["measurement-points"],
    queryFn: async () => {
      const { data, error } = await supabase.from("measurement_points").select("*").order("code");
      if (error) throw error;
      return data as MeasurementPoint[];
    },
  });

  const { data: thresholds } = useQuery({
    queryKey: ["thresholds"],
    queryFn: async () => {
      const { data, error } = await supabase.from("alarm_thresholds").select("*");
      if (error) throw error;
      return data as Threshold[];
    },
  });

  const assetsWithPoints = (assets ?? []).filter((a) =>
    (points ?? []).some((p) => p.asset_id === a.id),
  );
  const currentAsset = assetId || assetsWithPoints[0]?.id || "";
  const assetPoints = (points ?? []).filter((p) => p.asset_id === currentAsset);
  const currentPoint =
    assetPoints.find((p) => p.id === pointId)?.id ?? assetPoints[0]?.id ?? "";
  const threshold = (thresholds ?? []).find((t) => t.measurement_point_id === currentPoint);

  const { data: readings, isLoading } = useQuery({
    queryKey: ["readings", currentPoint],
    enabled: !!currentPoint,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vibration_readings")
        .select("*")
        .eq("measurement_point_id", currentPoint)
        .order("measured_at");
      if (error) throw error;
      return data as Reading[];
    },
  });

  const { data: diagnoses } = useQuery({
    queryKey: ["diagnoses", currentAsset],
    enabled: !!currentAsset,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diagnoses")
        .select("*")
        .eq("asset_id", currentAsset)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const addReading = useMutation({
    mutationFn: async (rows: Array<Record<string, unknown>>) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("vibration_readings")
        .insert(rows.map((r) => ({ ...r, created_by: auth.user?.id ?? null })) as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mediciones guardadas");
      queryClient.invalidateQueries({ queryKey: ["readings", currentPoint] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (e: Error) => toast.error("No se pudo guardar", { description: e.message }),
  });

  const addDiagnosis = useMutation({
    mutationFn: async (form: Record<string, unknown>) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("diagnoses")
        .insert({ ...form, created_by: auth.user?.id ?? null } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Diagnóstico registrado");
      queryClient.invalidateQueries({ queryKey: ["diagnoses", currentAsset] });
    },
    onError: (e: Error) => toast.error("No se pudo guardar", { description: e.message }),
  });

  const chartData = useMemo(
    () =>
      (readings ?? []).map((r) => ({
        fecha: new Date(r.measured_at).toLocaleDateString("es-AR", {
          day: "2-digit",
          month: "2-digit",
        }),
        velocidad: Number(r.velocity_rms),
        aceleracion: r.acceleration_rms == null ? null : Number(r.acceleration_rms),
        temperatura: r.temperature_c == null ? null : Number(r.temperature_c),
        rpm: r.rpm == null ? null : Number(r.rpm),
      })),
    [readings],
  );

  const last = (readings ?? [])[(readings ?? []).length - 1];

  async function importCsv(file: File) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const header = lines[0]?.toLowerCase().split(",").map((h) => h.trim()) ?? [];
    const idx = (name: string) => header.indexOf(name);
    const rows: Array<Record<string, unknown>> = [];
    for (const line of lines.slice(1)) {
      const cols = line.split(",").map((c) => c.trim());
      const velocity = Number(cols[idx("velocity_rms")]);
      if (!Number.isFinite(velocity)) continue;
      rows.push({
        measurement_point_id: currentPoint,
        measured_at: cols[idx("measured_at")] || new Date().toISOString(),
        velocity_rms: velocity,
        acceleration_rms: Number(cols[idx("acceleration_rms")]) || null,
        temperature_c: Number(cols[idx("temperature_c")]) || null,
        rpm: Number(cols[idx("rpm")]) || null,
        source: "csv",
      });
    }
    if (!rows.length) {
      toast.error("El archivo no tiene mediciones válidas", {
        description: "Se espera una columna velocity_rms.",
      });
      return;
    }
    addReading.mutate(rows);
  }

  return (
    <AppShell
      title="Mantenimiento predictivo"
      subtitle="Análisis de vibración de equipos críticos"
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="asset">Equipo</Label>
          <select
            id="asset"
            value={currentAsset}
            onChange={(e) => {
              setAssetId(e.target.value);
              setPointId("");
            }}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {assetsWithPoints.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="point">Punto de medición</Label>
          <select
            id="point"
            value={currentPoint}
            onChange={(e) => setPointId(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {assetPoints.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
              <div>
                <CardTitle className="text-display text-base">
                  Tendencia de velocidad (mm/s RMS)
                </CardTitle>
                <CardDescription>
                  Límites {threshold?.iso_class ?? "Clase II"}: bueno ≤{" "}
                  {threshold?.good_max ?? 2.8} · aceptable ≤ {threshold?.acceptable_max ?? 4.5} ·
                  alerta ≤ {threshold?.alert_max ?? 7.1}
                </CardDescription>
              </div>
              {last && (
                <Badge variant="outline" className={severityClass[last.severity]}>
                  <span className={`mr-2 h-2 w-2 rounded-full ${severityDot[last.severity]}`} />
                  {severityLabel[last.severity]} · {Number(last.velocity_rms).toFixed(2)} mm/s
                </Badge>
              )}
            </CardHeader>
            <CardContent className="h-72">
              {chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Este punto todavía no tiene mediciones.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" />
                    <XAxis dataKey="fecha" fontSize={11} stroke="var(--muted-foreground)" />
                    <YAxis fontSize={11} stroke="var(--muted-foreground)" />
                    <Tooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                    />
                    <ReferenceLine
                      y={threshold?.acceptable_max ?? 4.5}
                      stroke="var(--acceptable)"
                      strokeDasharray="4 4"
                    />
                    <ReferenceLine
                      y={threshold?.alert_max ?? 7.1}
                      stroke="var(--danger)"
                      strokeDasharray="4 4"
                    />
                    <Line
                      type="monotone"
                      dataKey="velocidad"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-display text-base">
                  Temperatura y aceleración
                </CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {chartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin datos.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" />
                      <XAxis dataKey="fecha" fontSize={11} stroke="var(--muted-foreground)" />
                      <YAxis fontSize={11} stroke="var(--muted-foreground)" />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: 6,
                          fontSize: 12,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="temperatura"
                        stroke="var(--alert)"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="aceleracion"
                        stroke="var(--good)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-display text-base">Cargar mediciones</CardTitle>
                <CardDescription>
                  Carga manual o archivo CSV con columnas measured_at, velocity_rms,
                  acceleration_rms, temperature_c, rpm.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form
                  className="grid gap-3 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    addReading.mutate([
                      {
                        measurement_point_id: currentPoint,
                        measured_at: new Date().toISOString(),
                        velocity_rms: Number(fd.get("velocity_rms")),
                        acceleration_rms: Number(fd.get("acceleration_rms")) || null,
                        temperature_c: Number(fd.get("temperature_c")) || null,
                        rpm: Number(fd.get("rpm")) || null,
                        source: "manual",
                      },
                    ]);
                    e.currentTarget.reset();
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="velocity_rms">Velocidad mm/s RMS</Label>
                    <Input
                      id="velocity_rms"
                      name="velocity_rms"
                      type="number"
                      step="0.01"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="acceleration_rms">Aceleración g</Label>
                    <Input id="acceleration_rms" name="acceleration_rms" type="number" step="0.01" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="temperature_c">Temperatura °C</Label>
                    <Input id="temperature_c" name="temperature_c" type="number" step="0.1" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rpm">RPM</Label>
                    <Input id="rpm" name="rpm" type="number" step="1" />
                  </div>
                  <Button type="submit" disabled={!currentPoint || addReading.isPending}>
                    Guardar medición
                  </Button>
                </form>

                <div className="space-y-2 border-t border-border pt-4">
                  <Label htmlFor="csv">
                    <Upload className="mr-1 inline h-4 w-4" /> Importar CSV
                  </Label>
                  <Input
                    id="csv"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void importCsv(file);
                      e.target.value = "";
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-display text-base">Diagnóstico del analista</CardTitle>
              <CardDescription>
                Registrá el tipo de falla detectada y la recomendación para este equipo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  addDiagnosis.mutate({
                    asset_id: currentAsset,
                    measurement_point_id: currentPoint || null,
                    fault_type: String(fd.get("fault_type")),
                    severity: String(fd.get("severity")),
                    findings: String(fd.get("findings")) || null,
                    recommendation: String(fd.get("recommendation")) || null,
                  });
                  e.currentTarget.reset();
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fault_type">Tipo de falla</Label>
                    <select
                      id="fault_type"
                      name="fault_type"
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {faultTypes.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="severity">Severidad</Label>
                    <select
                      id="severity"
                      name="severity"
                      defaultValue="alerta"
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {Object.entries(severityLabel).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="findings">Hallazgos</Label>
                  <Textarea id="findings" name="findings" rows={2} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recommendation">Recomendación</Label>
                  <Textarea id="recommendation" name="recommendation" rows={2} />
                </div>
                <Button type="submit" disabled={!currentAsset || addDiagnosis.isPending}>
                  Registrar diagnóstico
                </Button>
              </form>

              <div className="space-y-2 border-t border-border pt-4">
                {(diagnoses ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Sin diagnósticos para este equipo.
                  </p>
                )}
                {(diagnoses ?? []).map((d) => (
                  <div key={d.id} className="rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{d.fault_type}</p>
                      <Badge variant="outline" className={severityClass[d.severity]}>
                        {severityLabel[d.severity]}
                      </Badge>
                    </div>
                    {d.findings && <p className="mt-1 text-xs text-muted-foreground">{d.findings}</p>}
                    {d.recommendation && (
                      <p className="mt-1 text-xs">Recomendación: {d.recommendation}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(d.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
