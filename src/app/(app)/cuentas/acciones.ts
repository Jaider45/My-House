"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerContexto } from "@/lib/sesion";
import { mensajeError, type Estado } from "@/lib/acciones";

const esquema = z.object({
  id: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  tipo: z.enum(["banco", "efectivo", "tarjeta"]),
  nombre: z.string().trim().min(1, "Póngale un nombre a la cuenta.").max(80),
  saldo: z.coerce.number().int().min(0),
  titular: z.uuid().optional().or(z.literal("").transform(() => undefined)),
});

export async function guardarCuenta(_: Estado, datos: FormData): Promise<Estado> {
  const r = esquema.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: "Su rol es de solo lectura." };

  const { id, tipo, nombre, saldo, titular } = r.data;
  // En tarjetas el saldo inicial es la deuda: se guarda negativa.
  const fila = {
    tipo,
    nombre,
    saldo_inicial: tipo === "tarjeta" ? -saldo : saldo,
    titular_member_id: titular ?? null,
  };
  const { error } = id
    ? await ctx.supabase.from("accounts").update(fila).eq("id", id)
    : await ctx.supabase.from("accounts").insert({ ...fila, household_id: ctx.hogar.id });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/cuentas");
  return { ok: id ? "Cuenta actualizada." : "Cuenta creada." };
}

export async function archivarCuenta(datos: FormData) {
  const ctx = await obtenerContexto();
  const archivar = datos.get("archivar") === "1";
  await ctx.supabase.from("accounts").update({ archivada: archivar }).eq("id", String(datos.get("id")));
  revalidatePath("/cuentas");
}

/** Solo se borra si no tiene movimientos; si tiene, se archiva (borrar en cascada perdería historia). */
export async function eliminarCuenta(_: Estado, datos: FormData): Promise<Estado> {
  const id = String(datos.get("id"));
  const ctx = await obtenerContexto();
  const { count } = await ctx.supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .or(`account_id.eq.${id},cuenta_destino_id.eq.${id}`);
  if (count) return { error: `Tiene ${count} movimientos. Archívela en lugar de eliminarla.` };
  const { error } = await ctx.supabase.from("accounts").delete().eq("id", id);
  if (error) return { error: mensajeError(error) };
  revalidatePath("/cuentas");
  return { ok: "Cuenta eliminada." };
}
