"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerContexto } from "@/lib/sesion";
import { idDe, mensajeError, NO_ENCONTRADO, SOLO_LECTURA, type Estado } from "@/lib/acciones";

const opcional = <T extends z.ZodType>(e: T) => e.optional().or(z.literal("").transform(() => undefined));
const dia = opcional(z.coerce.number().int().min(1, "Día entre 1 y 31.").max(31, "Día entre 1 y 31."));

const esquema = z.object({
  id: opcional(z.uuid()),
  tipo: z.enum(["banco", "efectivo", "tarjeta", "billetera"]),
  nombre: z.string().trim().min(1, "Ponle un nombre a la cuenta.").max(80),
  entidad: opcional(z.string().trim().max(60)),
  ultimos4: opcional(z.string().regex(/^\d{4}$/, "Los últimos 4 dígitos son 4 números.")),
  saldo: z.coerce.number().int().min(0),
  cupo: z.coerce.number().int().min(0).optional(),
  dia_corte: dia,
  dia_pago: dia,
  titular: opcional(z.uuid()),
  recordar: z.literal("on").optional(),
});

export async function guardarCuenta(_: Estado, datos: FormData): Promise<Estado> {
  const r = esquema.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: "Tu rol es de solo lectura." };

  const { id, tipo, nombre, entidad, ultimos4, saldo, cupo, dia_corte, dia_pago, titular, recordar } = r.data;
  const tarjeta = tipo === "tarjeta";
  // En tarjetas el saldo inicial es la deuda: se guarda negativa.
  const fila = {
    tipo,
    nombre,
    entidad: entidad ?? null,
    ultimos4: ultimos4 ?? null,
    saldo_inicial: tarjeta ? -saldo : saldo,
    cupo: tarjeta && cupo ? cupo : null,
    dia_corte: tarjeta ? (dia_corte ?? null) : null,
    dia_pago: tarjeta ? (dia_pago ?? null) : null,
    titular_member_id: titular ?? null,
  };
  const { error } = id
    ? await ctx.supabase.from("accounts").update(fila).eq("id", id)
    : await ctx.supabase.from("accounts").insert({ ...fila, household_id: ctx.hogar.id });
  if (error) return { error: mensajeError(error) };

  if (!id && tarjeta && recordar && dia_pago) {
    // Recordatorio mensual del pago, 3 días antes, desde el próximo día de pago.
    const hoy = new Date();
    const proximo = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + (hoy.getUTCDate() > dia_pago ? 1 : 0), dia_pago));
    await ctx.supabase.from("reminders").insert({
      household_id: ctx.hogar.id,
      nombre: `Pago ${nombre}`,
      fecha: proximo.toISOString().slice(0, 10),
      repetir: "mensual",
      avisos: [3],
      canales: ["notificacion"],
    });
  }
  revalidatePath("/cuentas");
  return { ok: id ? "Cuenta actualizada." : "Cuenta creada." };
}

export async function archivarCuenta(_: Estado, datos: FormData): Promise<Estado> {
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: SOLO_LECTURA };
  const id = idDe(datos);
  if (!id) return { error: NO_ENCONTRADO };
  const archivar = datos.get("archivar") === "1";
  const { data, error } = await ctx.supabase.from("accounts").update({ archivada: archivar }).eq("id", id).select("id");
  if (error) return { error: mensajeError(error) };
  if (!data.length) return { error: NO_ENCONTRADO };
  revalidatePath("/cuentas");
  return { ok: archivar ? "Cuenta archivada." : "Cuenta activa de nuevo." };
}

/** Solo se borra si no tiene movimientos; si tiene, se archiva (borrar en cascada perdería historia). */
export async function eliminarCuenta(_: Estado, datos: FormData): Promise<Estado> {
  const id = String(datos.get("id"));
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: "Tu rol es de solo lectura." };
  const { count } = await ctx.supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .or(`account_id.eq.${id},cuenta_destino_id.eq.${id}`);
  if (count) return { error: `Tiene ${count} movimientos. Archívala en lugar de eliminarla.` };
  const { error } = await ctx.supabase.from("accounts").delete().eq("id", id);
  if (error) return { error: mensajeError(error) };
  revalidatePath("/cuentas");
  return { ok: "Cuenta eliminada." };
}
