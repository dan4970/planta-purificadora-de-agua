import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ClipboardList, Droplets, Gauge, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AquaMant — CRM de mantenimiento para planta purificadora" },
      {
        name: "description",
        content:
          "Controlá mantenimiento correctivo, preventivo y predictivo con análisis de vibración de los equipos críticos de tu planta purificadora de agua.",
      },
      { property: "og:title", content: "AquaMant — CRM de mantenimiento de planta" },
      {
        property: "og:description",
        content:
          "Equipos, órdenes de trabajo, plan preventivo y tendencias de vibración con semáforo ISO 10816.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: ClipboardList,
    title: "Correctivo",
    text: "Órdenes de trabajo con síntoma, causa raíz, repuestos, horas de paro y costo.",
  },
  {
    icon: Gauge,
    title: "Preventivo",
    text: "Rutinas programadas por días u horas de operación, con checklist y avisos de vencimiento.",
  },
  {
    icon: Activity,
    title: "Predictivo",
    text: "Vibración de equipos críticos: tendencia, semáforo ISO 10816 y diagnóstico de falla.",
  },
];

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-5xl flex-col px-6 py-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplets className="h-6 w-6 text-primary" />
            <span className="text-display text-xl font-semibold">AquaMant</span>
          </div>
          <Button asChild variant="outline">
            <Link to="/auth">Ingresar</Link>
          </Button>
        </header>

        <section className="mt-20 max-w-3xl">
          <p className="text-display text-sm text-primary">
            Gestión de mantenimiento industrial · Planta purificadora
          </p>
          <h1 className="mt-4 text-5xl font-semibold leading-[1.05] sm:text-6xl">
            Mantenimiento correctivo, preventivo y predictivo en un solo tablero
          </h1>
          <p className="mt-6 max-w-2xl text-base text-muted-foreground">
            Desde la bomba de agua cruda hasta la paletizadora: historial por equipo, órdenes de
            trabajo, rutinas programadas y análisis de vibración con recolección automática de datos
            de sensores para diagnosticar el estado real de las máquinas críticas.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">Entrar al sistema</Link>
            </Button>
          </div>
        </section>

        <section className="mt-24 grid gap-4 sm:grid-cols-3">
          {features.map((f) => (
            <article key={f.title} className="rounded-md border border-border bg-card p-5">
              <f.icon className="h-5 w-5 text-primary" />
              <h2 className="mt-4 text-lg font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </article>
          ))}
        </section>

        <footer className="mt-24 flex items-center gap-2 border-t border-border pt-6 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          Acceso por usuario con roles de administrador, supervisor y técnico.
        </footer>
      </div>
    </div>
  );
}
