"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerContexto } from "@/lib/sesion";
import { hoy, parsearFecha } from "@/lib/fechas";
import { mensajeError, type Estado } from "@/lib/acciones";
import { avanceMeta } from "@/lib/metas";
import { proximoDia } from "@/lib/deudas";

const opcional = <T extends z.ZodType>(e: T) => e.optional().or(z.literal("").transform(() => undefined));

const esquemaMeta = z.object({
  nombre: z.string().trim().min(1, "Ponle un nombre a la meta.").max(80),
  monto: z.coerce.number().int().positive("Escribe cuánto quieren ahorrar."),
  ahorrado_inicial: z.coerce.number().int().min(0),
  aporte_mensual: z.coerce.number().int().min(0).default(0),
  /** «¿Para cuándo?»: un mes (AAAA-MM, se guarda el último día) o una fecha. */
  fecha_objetivo: opcional(
    z.string().transform((v, c) => {
      if (/^\d{4}-\d{2}$/.test(v)) {
        const [a, m] = v.split("-").map(Number);
        return `${v}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, "0")}`;
      }
      return parsearFecha(v) ?? (c.addIssue({ code: "custom", message: "Fecha no válida." }), "");
    }),
  ),
  es_emergencia: z.literal("on").optional(),
  /** «Aportar solo cada mes»: crea un pago fijo el día 1 ligado a la meta. */
  automatico: z
    .enum(["1", "0"])
    .optional()
    .transform((v) => v === "1"),
  account_id: opcional(z.uuid("Elige la cuenta.")),
});

export async function guardarMeta(_: Estado, datos: FormData): Promise<Estado> {
  const r = esquemaMeta.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: "Tu rol es de solo lectura." };
  const { aporte_mensual, es_emergencia, automatico, account_id, ...resto } = r.data;
  // Sin aporte escrito, el sugerido para llegar a la fecha.
  const sugerido = resto.fecha_objetivo ? avanceMeta({ objetivo: resto.monto, ahorrado: resto.ahorrado_inicial, aporteMensual: null, fechaObjetivo: resto.fecha_objetivo }, hoy()).aporteSugerido : null;
  const aporte = aporte_mensual || sugerido || null;
  if (automatico && (!aporte || !account_id)) return { error: "Para aportar solo cada mes, pon la fecha y elige la cuenta." };
  const { data: meta, error } = await ctx.supabase
    .from("budgets_goals")
    .insert({
      ...resto,
      household_id: ctx.hogar.id,
      tipo: "meta",
      periodo: "unico",
      aporte_mensual: aporte,
      es_emergencia: !!es_emergencia,
      icono: es_emergencia ? "ahorro" : "meta",
    })
    .select("id")
    .single();
  if (error) return { error: mensajeError(error) };

  if (automatico && aporte && account_id) {
    const { data: categoria } = await ctx.supabase.from("categories").select("id").eq("excluir_de_costo_vida", true).eq("clase", "gasto").is("padre_id", null).limit(1).maybeSingle();
    if (categoria) {
      const inicio = proximoDia(1, hoy());
      const falta = Math.max(0, resto.monto - resto.ahorrado_inicial);
      const regla = await ctx.supabase.from("recurring_rules").insert({
        household_id: ctx.hogar.id,
        descripcion: `Aporte ${resto.nombre}`.slice(0, 120),
        monto: aporte,
        tipo: "gasto",
        account_id,
        category_id: categoria.id,
        member_id: ctx.miembro.id,
        frecuencia: "mensual",
        fecha_inicio: inicio,
        proxima_fecha: inicio,
        ocurrencias_max: Math.max(1, Math.ceil(falta / aporte)),
        goal_id: meta.id,
        recordar: true,
      });
      if (regla.error) return { error: `La meta quedó creada, pero no su aporte automático: ${mensajeError(regla.error)}` };
      await ctx.supabase.rpc("generar_recurrentes_hogar", { p_household: ctx.hogar.id });
      revalidatePath("/recurrentes");
    }
  }
  revalidatePath("/metas");
  return { ok: automatico ? "Meta creada: el aporte queda en tus pagos fijos cada día 1." : "Meta creada." };
}

const esquemaAporte = z.object({
  goal_id: z.uuid(),
  monto: z.coerce.number().int().positive("Escribe el aporte."),
  account_id: z.uuid("Elige la cuenta."),
});

/** Un aporte es un gasto en «Ahorro e inversión» (no cuenta como costo de vida) ligado a la meta. */
export async function aportar(_: Estado, datos: FormData): Promise<Estado> {
  const r = esquemaAporte.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: "Tu rol es de solo lectura." };
  const [{ data: meta }, { data: categoria }] = await Promise.all([
    ctx.supabase.from("budgets_goals").select("nombre").eq("id", r.data.goal_id).single(),
    ctx.supabase.from("categories").select("id").eq("excluir_de_costo_vida", true).eq("clase", "gasto").is("padre_id", null).limit(1).maybeSingle(),
  ]);
  const { error } = await ctx.supabase.from("transactions").insert({
    household_id: ctx.hogar.id,
    account_id: r.data.account_id,
    fecha: hoy(),
    monto: r.data.monto,
    tipo: "gasto",
    category_id: categoria?.id ?? null,
    comercio: `Aporte ${meta?.nombre ?? "meta"}`,
    member_id: ctx.miembro.id,
    goal_id: r.data.goal_id,
  });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/metas");
  return { ok: "Aporte registrado." };
}
