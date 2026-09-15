import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const readingSchema = z.object({
  sensor_id: z.string().optional(),
  measurement_point_code: z.string().optional(),
  measured_at: z.string().optional(),
  velocity_rms: z.number(),
  acceleration_rms: z.number().nullable().optional(),
  temperature_c: z.number().nullable().optional(),
  rpm: z.number().nullable().optional(),
});

const bodySchema = z.object({ readings: z.array(readingSchema).min(1).max(500) });

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const Route = createFileRoute("/api/public/vibration-ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key =
          request.headers.get("x-api-key") ??
          request.headers.get("authorization")?.replace(/^Bearer /, "") ??
          "";
        if (!key) return Response.json({ error: "Falta la clave" }, { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const hash = await sha256Hex(key);
        const { data: tokenRow } = await supabaseAdmin
          .from("ingest_tokens")
          .select("id, active")
          .eq("token_hash", hash)
          .maybeSingle();

        if (!tokenRow || !tokenRow.active) {
          return Response.json({ error: "Clave inválida" }, { status: 401 });
        }

        let parsed: z.infer<typeof bodySchema>;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch {
          return Response.json({ error: "Formato inválido" }, { status: 400 });
        }

        const { data: points } = await supabaseAdmin
          .from("measurement_points")
          .select("id, code, sensor_id");

        const bySensor = new Map<string, string>();
        const byCode = new Map<string, string>();
        for (const p of points ?? []) {
          if (p.sensor_id) bySensor.set(p.sensor_id, p.id);
          byCode.set(p.code, p.id);
        }

        const rows: Array<{
          measurement_point_id: string;
          measured_at: string;
          velocity_rms: number;
          acceleration_rms: number | null;
          temperature_c: number | null;
          rpm: number | null;
          source: string;
        }> = [];
        const unmatched: string[] = [];
        for (const r of parsed.readings) {
          const pointId =
            (r.sensor_id && bySensor.get(r.sensor_id)) ||
            (r.measurement_point_code && byCode.get(r.measurement_point_code)) ||
            null;
          if (!pointId) {
            unmatched.push(r.sensor_id ?? r.measurement_point_code ?? "sin identificador");
            continue;
          }
          rows.push({
            measurement_point_id: pointId,
            measured_at: r.measured_at ?? new Date().toISOString(),
            velocity_rms: r.velocity_rms,
            acceleration_rms: r.acceleration_rms ?? null,
            temperature_c: r.temperature_c ?? null,
            rpm: r.rpm ?? null,
            source: "sensor",
          });
        }

        if (rows.length) {
          const { error } = await supabaseAdmin.from("vibration_readings").insert(rows);
          if (error) return Response.json({ error: error.message }, { status: 500 });
        }

        await supabaseAdmin
          .from("ingest_tokens")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", tokenRow.id);

        return Response.json({ inserted: rows.length, unmatched });
      },
    },
  },
});
