"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerContexto } from "@/lib/sesion";
import { idDe, mensajeError, NO_ENCONTRADO, SOLO_LECTURA, type Estado } from "@/lib/acciones";
import { FRECUENCIAS, primeraDesde } from "@/lib/recurrentes";
import { hoy, parsearFecha } from "@/lib/fechas";

const esquema = z.object({
  id: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  descripcion: z.string().trim().min(1, "Escribe una descripción.").max(120),
  monto: z.coerce.number().int().positive("Escribe un monto mayor que cero."),
  tipo: z.enum(["gasto", "ingreso"]),
  account_id: z.uuid("Elige una cuenta."),
  category_id: z.uuid("Elige una categoría."),
  frecuencia: z.enum(FRECUENCIAS),
  fecha_inicio: z.string().transform((v, c) => parsearFecha(v) ?? (c.addIssue({ code: "custom", message: "Fecha no válida." }), "")),
});

type Ctx = Awaited<ReturnType<typeof obtenerContexto>>;

/**
 * Quita los programados futuros de la regla y la reprograma desde hoy (cambios de monto, fecha o pausa).
 * Devuelve el mensaje de error del primer paso que falle, o null.
 */
async function reprogramar(ctx: Ctx, id: string, inicio: string, frecuencia: (typeof FRECUENCIAS)[number], activa: boolean): Promise<string | null> {
  const desde = hoy();
  const borrar = await ctx.supabase.from("transactions").delete().eq("recurring_rule_id", id).eq("estado", "programado").gte("fecha", desde);
  if (borrar.error) return mensajeError(borrar.error);
  const { ocurrencias, fecha } = primeraDesde(inicio, frecuencia, desde);
  const regla = await ctx.supabase.from("recurring_rules").update({ proxima_fecha: fecha, ocurrencias, activa }).eq("id", id).select("id");
  if (regla.error) return mensajeError(regla.error);
  if (!regla.data.length) return NO_ENCONTRADO;
  if (activa) {
    const generar = await ctx.supabase.rpc("generar_recurrentes_hogar", { p_household: ctx.hogar.id });
    if (generar.error) return mensajeError(generar.error);
  }
  return null;
}

function refrescar() {
  revalidatePath("/recurrentes");
  revalidatePath("/movimientos");
  revalidatePath("/presupuesto");
  revalidatePath("/");
}

export async function guardarRegla(_: Estado, datos: FormData): Promise<Estado> {
  const r = esquema.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: SOLO_LECTURA };

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
  const fallo = await reprogramar(ctx, res.data.id, campos.fecha_inicio, campos.frecuencia, res.data.activa);
  refrescar();
  if (fallo) return { error: `Se guardó la regla, pero no pude reprogramar sus pagos: ${fallo}` };
  return { ok: id ? "Cambios guardados." : "Listo: ya cuenta en el presupuesto y en el costo de vida del mes." };
}

export async function cambiarEstadoRegla(_: Estado, datos: FormData): Promise<Estado> {
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: SOLO_LECTURA };
  const id = idDe(datos);
  if (!id) return { error: NO_ENCONTRADO };
  const { data: regla } = await ctx.supabase.from("recurring_rules").select("fecha_inicio, frecuencia").eq("id", id).maybeSingle();
  if (!regla) return { error: NO_ENCONTRADO };
  const activar = datos.get("activar") === "1";
  const fallo = await reprogramar(ctx, id, regla.fecha_inicio, regla.frecuencia, activar);
  refrescar();
  if (fallo) return { error: fallo };
  return { ok: activar ? "Pago fijo reactivado." : "Pago fijo pausado." };
}

export async function eliminarRegla(_: Estado, datos: FormData): Promise<Estado> {
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: SOLO_LECTURA };
  const id = idDe(datos);
  if (!id) return { error: NO_ENCONTRADO };
  // Los programados pendientes se van con la regla; los confirmados quedan como historia.
  const programados = await ctx.supabase.from("transactions").delete().eq("recurring_rule_id", id).eq("estado", "programado");
  if (programados.error) return { error: mensajeError(programados.error) };
  const { data, error } = await ctx.supabase.from("recurring_rules").delete().eq("id", id).select("id");
  if (error) return { error: mensajeError(error) };
  if (!data.length) return { error: NO_ENCONTRADO };
  refrescar();
  return { ok: "Pago fijo eliminado." };
}
