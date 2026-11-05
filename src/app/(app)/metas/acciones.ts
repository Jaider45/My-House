"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerContexto } from "@/lib/sesion";
import { hoy, parsearFecha } from "@/lib/fechas";
import { mensajeError, type Estado } from "@/lib/acciones";

const opcional = <T extends z.ZodType>(e: T) => e.optional().or(z.literal("").transform(() => undefined));

const esquemaMeta = z.object({
  nombre: z.string().trim().min(1, "Ponle un nombre a la meta.").max(80),
  monto: z.coerce.number().int().positive("Escribe cuánto quieren ahorrar."),
  ahorrado_inicial: z.coerce.number().int().min(0),
  aporte_mensual: z.coerce.number().int().min(0),
  fecha_objetivo: opcional(z.string().transform((v, c) => parsearFecha(v) ?? (c.addIssue({ code: "custom", message: "Fecha no válida." }), ""))),
  es_emergencia: z.literal("on").optional(),
});

export async function guardarMeta(_: Estado, datos: FormData): Promise<Estado> {
  const r = esquemaMeta.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: "Tu rol es de solo lectura." };
  const { aporte_mensual, es_emergencia, ...resto } = r.data;
  const { error } = await ctx.supabase.from("budgets_goals").insert({
    ...resto,
    household_id: ctx.hogar.id,
    tipo: "meta",
    periodo: "unico",
    aporte_mensual: aporte_mensual || null,
    es_emergencia: !!es_emergencia,
    icono: es_emergencia ? "ahorro" : "meta",
  });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/metas");
  return { ok: "Meta creada." };
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
