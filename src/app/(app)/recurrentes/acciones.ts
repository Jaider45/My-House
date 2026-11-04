"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerContexto } from "@/lib/sesion";
import { mensajeError, type Estado } from "@/lib/acciones";
import { FRECUENCIAS, primeraDesde } from "@/lib/recurrentes";
import { hoy, parsearFecha } from "@/lib/fechas";

const esquema = z.object({
  id: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  descripcion: z.string().trim().min(1, "Escriba una descripción.").max(120),
  monto: z.coerce.number().int().positive("Escriba un monto mayor que cero."),
  tipo: z.enum(["gasto", "ingreso"]),
  account_id: z.uuid("Elija una cuenta."),
  category_id: z.uuid("Elija una categoría."),
  frecuencia: z.enum(FRECUENCIAS),
  fecha_inicio: z.string().transform((v, c) => parsearFecha(v) ?? (c.addIssue({ code: "custom", message: "Fecha no válida." }), "")),
});

type Ctx = Awaited<ReturnType<typeof obtenerContexto>>;

/** Quita los programados futuros de la regla y la reprograma desde hoy (cambios de monto, fecha o pausa). */
async function reprogramar(ctx: Ctx, id: string, inicio: string, frecuencia: (typeof FRECUENCIAS)[number], activa: boolean) {
  const desde = hoy();
  await ctx.supabase.from("transactions").delete().eq("recurring_rule_id", id).eq("estado", "programado").gte("fecha", desde);
  const { ocurrencias, fecha } = primeraDesde(inicio, frecuencia, desde);
  await ctx.supabase.from("recurring_rules").update({ proxima_fecha: fecha, ocurrencias, activa }).eq("id", id);
  if (activa) await ctx.supabase.rpc("generar_recurrentes_hogar", { p_household: ctx.hogar.id });
}

function refrescar() {
  revalidatePath("/recurrentes");
  revalidatePath("/movimientos");
  revalidatePath("/");
}

export async function guardarRegla(_: Estado, datos: FormData): Promise<Estado> {
  const r = esquema.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: "Su rol es de solo lectura." };

  const { id, ...campos } = r.data;
  const { ocurrencias, fecha } = primeraDesde(campos.fecha_inicio, campos.frecuencia, hoy());
  const res = id
    ? await ctx.supabase.from("recurring_rules").update(campos).eq("id", id).select("id, activa").single()
    : await ctx.supabase
        .from("recurring_rules")
        .insert({ ...campos, household_id: ctx.hogar.id, proxima_fecha: fecha, ocurrencias })
        .select("id, activa")
        .single();
  if (res.error) return { error: mensajeError(res.error) };
  await reprogramar(ctx, res.data.id, campos.fecha_inicio, campos.frecuencia, res.data.activa);
  refrescar();
  return { ok: id ? "Regla actualizada." : "Regla creada. Los próximos 7 días ya quedaron programados." };
}

export async function cambiarEstadoRegla(datos: FormData) {
  const ctx = await obtenerContexto();
  const id = String(datos.get("id"));
  const { data: regla } = await ctx.supabase.from("recurring_rules").select("fecha_inicio, frecuencia").eq("id", id).single();
  if (!regla) return;
  await reprogramar(ctx, id, regla.fecha_inicio, regla.frecuencia, datos.get("activar") === "1");
  refrescar();
}

export async function eliminarRegla(datos: FormData) {
  const ctx = await obtenerContexto();
  const id = String(datos.get("id"));
  // Los programados pendientes se van con la regla; los confirmados quedan como historia.
  await ctx.supabase.from("transactions").delete().eq("recurring_rule_id", id).eq("estado", "programado");
  await ctx.supabase.from("recurring_rules").delete().eq("id", id);
  refrescar();
}
