export type Severity = "bueno" | "aceptable" | "alerta" | "peligro";
export type Criticality = "critico" | "importante" | "general";
export type AssetStatus = "operativo" | "alarma" | "mantenimiento" | "detenido";
export type WoType = "correctivo" | "preventivo" | "predictivo";
export type WoStatus = "abierta" | "en_proceso" | "espera_repuesto" | "cerrada" | "cancelada";
export type WoPriority = "baja" | "media" | "alta" | "urgente";
export type AppRole = "admin" | "supervisor" | "tecnico";

export interface Asset {
  id: string;
  code: string;
  name: string;
  area: string;
  criticality: Criticality;
  location: string | null;
  status: AssetStatus;
  service_hours: number;
  model: string | null;
  serial_number: string | null;
  notes: string | null;
}

export interface WorkOrder {
  id: string;
  wo_number: number;
  asset_id: string;
  type: WoType;
  priority: WoPriority;
  status: WoStatus;
  title: string;
  description: string | null;
  symptom: string | null;
  work_done: string | null;
  root_cause: string | null;
  assigned_to: string | null;
  downtime_hours: number;
  labor_hours: number;
  cost: number;
  due_date: string | null;
  opened_at: string;
  closed_at: string | null;
}

export interface PmPlan {
  id: string;
  asset_id: string;
  name: string;
  description: string | null;
  frequency_type: "dias" | "horas";
  frequency_value: number;
  checklist: string[];
  estimated_hours: number;
  last_done_at: string | null;
  next_due_at: string;
  active: boolean;
}

export interface MeasurementPoint {
  id: string;
  asset_id: string;
  code: string;
  name: string;
  position: string | null;
  direction: string | null;
  sensor_id: string | null;
}

export interface Reading {
  id: string;
  measurement_point_id: string;
  measured_at: string;
  velocity_rms: number;
  acceleration_rms: number | null;
  temperature_c: number | null;
  rpm: number | null;
  source: string;
  severity: Severity;
}

export interface Threshold {
  id: string;
  measurement_point_id: string;
  good_max: number;
  acceptable_max: number;
  alert_max: number;
  temperature_max: number;
  iso_class: string;
}

export const severityLabel: Record<Severity, string> = {
  bueno: "Bueno",
  aceptable: "Aceptable",
  alerta: "Alerta",
  peligro: "Peligro",
};

export const severityClass: Record<Severity, string> = {
  bueno: "bg-good/15 text-good border-good/40",
  aceptable: "bg-acceptable/15 text-acceptable border-acceptable/40",
  alerta: "bg-alert/15 text-alert border-alert/40",
  peligro: "bg-danger/20 text-danger border-danger/50",
};

export const severityDot: Record<Severity, string> = {
  bueno: "bg-good",
  aceptable: "bg-acceptable",
  alerta: "bg-alert",
  peligro: "bg-danger",
};

export const statusLabel: Record<AssetStatus, string> = {
  operativo: "Operativo",
  alarma: "En alarma",
  mantenimiento: "En mantenimiento",
  detenido: "Detenido",
};

export const statusClass: Record<AssetStatus, string> = {
  operativo: "bg-good/15 text-good border-good/40",
  alarma: "bg-danger/20 text-danger border-danger/50",
  mantenimiento: "bg-acceptable/15 text-acceptable border-acceptable/40",
  detenido: "bg-muted text-muted-foreground border-border",
};

export const criticalityLabel: Record<Criticality, string> = {
  critico: "Crítico",
  importante: "Importante",
  general: "General",
};

export const woStatusLabel: Record<WoStatus, string> = {
  abierta: "Abierta",
  en_proceso: "En proceso",
  espera_repuesto: "Espera de repuesto",
  cerrada: "Cerrada",
  cancelada: "Cancelada",
};

export const woStatusClass: Record<WoStatus, string> = {
  abierta: "bg-primary/15 text-primary border-primary/40",
  en_proceso: "bg-acceptable/15 text-acceptable border-acceptable/40",
  espera_repuesto: "bg-alert/15 text-alert border-alert/40",
  cerrada: "bg-good/15 text-good border-good/40",
  cancelada: "bg-muted text-muted-foreground border-border",
};

export const woTypeLabel: Record<WoType, string> = {
  correctivo: "Correctivo",
  preventivo: "Preventivo",
  predictivo: "Predictivo",
};

export const priorityLabel: Record<WoPriority, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  urgente: "Urgente",
};

export const priorityClass: Record<WoPriority, string> = {
  baja: "bg-muted text-muted-foreground border-border",
  media: "bg-primary/15 text-primary border-primary/40",
  alta: "bg-alert/15 text-alert border-alert/40",
  urgente: "bg-danger/20 text-danger border-danger/50",
};

export const roleLabel: Record<AppRole, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  tecnico: "Técnico",
};

export function severityFor(velocity: number, t?: Threshold | null): Severity {
  const good = t?.good_max ?? 2.8;
  const acceptable = t?.acceptable_max ?? 4.5;
  const alert = t?.alert_max ?? 7.1;
  if (velocity <= good) return "bueno";
  if (velocity <= acceptable) return "aceptable";
  if (velocity <= alert) return "alerta";
  return "peligro";
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function daysUntil(value: string): number {
  return Math.round((new Date(value).getTime() - Date.now()) / 86_400_000);
}
