"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerContexto } from "@/lib/sesion";
import { hoy, parsearFecha } from "@/lib/fechas";
import { mensajeError, type Estado } from "@/lib/acciones";

const opcional = <T extends z.ZodType>(e: T) => e.optional().or(z.literal("").transform(() => undefined));

const esquemaDeuda = z.object({
  nombre: z.string().trim().min(1, "Ponle un nombre a la deuda.").max(80),
  detalle: opcional(z.string().trim().max(120)),
  monto: z.coerce.number().int().positive("Escribe el saldo acordado."),
  pagado_inicial: z.coerce.number().int().min(0),
  cuota: z.coerce.number().int().min(0),
  cuotas_total: opcional(z.coerce.number().int().positive()),
  dia_pago: opcional(z.coerce.number().int().min(1).max(31)),
  fecha_limite: opcional(z.string().transform((v, c) => parsearFecha(v) ?? (c.addIssue({ code: "custom", message: "Fecha no válida." }), ""))),
});

export async function guardarDeuda(_: Estado, datos: FormData): Promise<Estado> {
  const r = esquemaDeuda.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: "Tu rol es de solo lectura." };
  const { cuota, ...resto } = r.data;
  const { error } = await ctx.supabase.from("debts").insert({ ...resto, cuota: cuota || null, household_id: ctx.hogar.id, member_id: ctx.miembro.id });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/deudas");
  return { ok: "Deuda agregada." };
}

const esquemaAbono = z.object({
  debt_id: z.uuid(),
  monto: z.coerce.number().int().positive("Escribe el monto del abono."),
  account_id: z.uuid("Elige la cuenta."),
});

/** Un abono es un gasto en la categoría Deudas ligado a la deuda (así cuenta en el costo de vida del mes). */
export async function registrarAbono(_: Estado, datos: FormData): Promise<Estado> {
  const r = esquemaAbono.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: "Tu rol es de solo lectura." };
  const [{ data: deuda }, { data: categoria }] = await Promise.all([
    ctx.supabase.from("debts").select("nombre").eq("id", r.data.debt_id).single(),
    ctx.supabase.from("categories").select("id").eq("nombre", "Deudas").is("padre_id", null).maybeSingle(),
  ]);
  const { error } = await ctx.supabase.from("transactions").insert({
    household_id: ctx.hogar.id,
    account_id: r.data.account_id,
    fecha: hoy(),
    monto: r.data.monto,
    tipo: "gasto",
    category_id: categoria?.id ?? null,
    comercio: `Abono ${deuda?.nombre ?? "deuda"}`,
    member_id: ctx.miembro.id,
    debt_id: r.data.debt_id,
  });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/deudas");
  revalidatePath("/");
  return { ok: "Abono registrado." };
}
