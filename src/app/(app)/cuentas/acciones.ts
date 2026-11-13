"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerContexto } from "@/lib/sesion";
import { idDe, mensajeError, NO_ENCONTRADO, SOLO_LECTURA, type Estado } from "@/lib/acciones";
import { proximoDia } from "@/lib/deudas";
import { hoy } from "@/lib/fechas";

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
  subtipo: opcional(z.enum(["ahorros", "corriente"])),
  recordar: z.enum(["1", "0", "on"]).optional(),
  pago_fijo: z.enum(["1", "0"]).optional(),
  cuota: z.coerce.number().int().min(0).default(0),
  pago_desde: opcional(z.uuid()),
});

export async function guardarCuenta(_: Estado, datos: FormData): Promise<Estado> {
  const r = esquema.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: r.error.issues[0].message };
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: "Tu rol es de solo lectura." };

  const { id, tipo, nombre, entidad, ultimos4, saldo, cupo, dia_corte, dia_pago, titular, subtipo } = r.data;
  const recordar = r.data.recordar === "1" || r.data.recordar === "on";
  const pagoFijo = r.data.pago_fijo === "1";
  if (pagoFijo && (!r.data.cuota || !r.data.pago_desde || !dia_pago)) return { error: "Para el pago fijo de la tarjeta escribe la cuota, el día límite de pago y desde qué cuenta se paga." };
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
    subtipo: tipo === "banco" ? (subtipo ?? null) : null,
  };
  const res = id
    ? await ctx.supabase.from("accounts").update(fila).eq("id", id).select("id").single()
    : await ctx.supabase.from("accounts").insert({ ...fila, household_id: ctx.hogar.id }).select("id").single();
  if (res.error) return { error: mensajeError(res.error) };

  if (!id && tarjeta && dia_pago && (recordar || pagoFijo)) {
    const primera = proximoDia(dia_pago, hoy());
    if (pagoFijo) {
      // Pagar la tarjeta = transferencia del banco a la tarjeta (decisión 9): no cuenta como gasto.
      const regla = await ctx.supabase.from("recurring_rules").insert({
        household_id: ctx.hogar.id,
        descripcion: `Pago ${nombre}`.slice(0, 120),
        monto: r.data.cuota,
        tipo: "transferencia",
        account_id: r.data.pago_desde!,
        cuenta_destino_id: res.data.id,
        category_id: null,
        member_id: ctx.miembro.id,
        frecuencia: "mensual",
        fecha_inicio: primera,
        proxima_fecha: primera,
        recordar,
      });
      if (regla.error) return { error: `La tarjeta quedó guardada, pero no su pago fijo: ${mensajeError(regla.error)}` };
      await ctx.supabase.rpc("generar_recurrentes_hogar", { p_household: ctx.hogar.id });
      revalidatePath("/recurrentes");
    } else {
      // Recordatorio mensual del pago, 3 días antes del día límite.
      await ctx.supabase.from("reminders").insert({
        household_id: ctx.hogar.id,
        nombre: `Pago ${nombre}`,
        fecha: primera,
        repetir: "mensual",
        avisos: [3],
        canales: ["correo", "notificacion"],
        account_id: res.data.id,
      });
      revalidatePath("/recordatorios");
    }
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
  const ctx = await obtenerContexto();
  if (!ctx.puedeEditar) return { error: SOLO_LECTURA };
  // Validado como UUID: va dentro de un filtro `or(...)` de PostgREST (decisión 28).
  const id = idDe(datos);
  if (!id) return { error: NO_ENCONTRADO };
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
