import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Copy, KeyRound, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  createIngestToken,
  listIngestTokens,
  revokeIngestToken,
} from "@/lib/admin.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/integracion")({
  head: () => ({
    meta: [
      { title: "Conexión de sensores — AquaMant" },
      {
        name: "description",
        content:
          "Clave y formato para que el servidor de sensores envíe automáticamente las lecturas de vibración.",
      },
      { property: "og:title", content: "Conexión de sensores — AquaMant" },
      {
        property: "og:description",
        content: "Punto de entrada seguro para la recepción automática de mediciones.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Integracion,
});

function Integracion() {
  const { isAdmin } = useCurrentUser();
  const queryClient = useQueryClient();
  const list = useServerFn(listIngestTokens);
  const create = useServerFn(createIngestToken);
  const revoke = useServerFn(revokeIngestToken);
  const [fresh, setFresh] = useState<string | null>(null);
  const [name, setName] = useState("");

  const endpoint =
    typeof window === "undefined"
      ? "/api/public/vibration-ingest"
      : `${window.location.origin}/api/public/vibration-ingest`;

  const { data: tokens, isLoading } = useQuery({
    queryKey: ["ingest-tokens"],
    queryFn: () => list(),
    enabled: isAdmin,
  });

  const add = useMutation({
    mutationFn: () => create({ data: { name } }),
    onSuccess: (res) => {
      setFresh(res.token);
      setName("");
      toast.success("Clave creada, copiala ahora");
      queryClient.invalidateQueries({ queryKey: ["ingest-tokens"] });
    },
    onError: (e: Error) => toast.error("No se pudo crear", { description: e.message }),
  });

  const off = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => {
      toast.success("Clave desactivada");
      queryClient.invalidateQueries({ queryKey: ["ingest-tokens"] });
    },
    onError: (e: Error) => toast.error("No se pudo desactivar", { description: e.message }),
  });

  const sample = `curl -X POST ${endpoint} \\
  -H "x-api-key: TU_CLAVE" \\
  -H "content-type: application/json" \\
  -d '{"readings":[{"sensor_id":"SN-TR-001-MH","measured_at":"2026-09-14T12:00:00Z","velocity_rms":3.4,"acceleration_rms":1.2,"temperature_c":58,"rpm":2950}]}'`;

  return (
    <AppShell
      title="Conexión de sensores"
      subtitle="Recepción automática de lecturas de vibración"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-display text-base">Claves de acceso</CardTitle>
            <CardDescription>
              Cada clave permite a tu servidor de sensores enviar lecturas. Se muestra una sola
              vez.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isAdmin ? (
              <p className="text-sm text-muted-foreground">
                Solo un administrador puede ver y crear claves.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-48 flex-1 space-y-2">
                    <Label htmlFor="name">Nombre de la clave</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Servidor de sensores planta"
                    />
                  </div>
                  <Button
                    onClick={() => add.mutate()}
                    disabled={name.trim().length < 2 || add.isPending}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Crear
                  </Button>
                </div>

                {fresh && (
                  <div className="space-y-2 rounded-md border border-primary/40 bg-primary/10 p-3">
                    <p className="text-xs text-muted-foreground">
                      Copiá esta clave ahora, no vuelve a mostrarse.
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="min-w-0 flex-1 break-all font-mono text-xs">{fresh}</code>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          void navigator.clipboard.writeText(fresh);
                          toast.success("Clave copiada");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {isLoading ? (
                  <Skeleton className="h-24" />
                ) : (
                  <div className="space-y-2">
                    {(tokens ?? []).length === 0 && (
                      <p className="text-sm text-muted-foreground">Todavía no hay claves.</p>
                    )}
                    {(tokens ?? []).map((t) => (
                      <div
                        key={t.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            <KeyRound className="mr-1 inline h-3 w-3" />
                            {t.name}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {t.token_prefix}… · último uso {formatDateTime(t.last_used_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={
                              t.active
                                ? "border-good/40 bg-good/15 text-good"
                                : "border-border bg-muted text-muted-foreground"
                            }
                          >
                            {t.active ? "Activa" : "Desactivada"}
                          </Badge>
                          {t.active && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => off.mutate(t.id)}
                              disabled={off.isPending}
                            >
                              Desactivar
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-display text-base">Cómo enviar las lecturas</CardTitle>
            <CardDescription>
              Tu servidor envía un lote de lecturas al punto de entrada, identificando cada punto
              de medición por el identificador del sensor o por el código del punto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Dirección</Label>
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
                <code className="min-w-0 flex-1 break-all font-mono text-xs">{endpoint}</code>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    void navigator.clipboard.writeText(endpoint);
                    toast.success("Dirección copiada");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ejemplo de envío</Label>
              <pre className="overflow-x-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-xs">
                {sample}
              </pre>
            </div>
            <p className="text-xs text-muted-foreground">
              Cada lectura se clasifica automáticamente con el semáforo del punto y, si supera el
              límite, el equipo pasa a estado de alarma.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
