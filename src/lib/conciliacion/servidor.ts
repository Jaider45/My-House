import "server-only";
import type { obtenerContexto } from "@/lib/sesion";
import { formatearCOP } from "@/lib/dinero";
import { formatearDia, sumarDias } from "@/lib/fechas";
import { mensajeError } from "@/lib/acciones";
import { buscarPar, buscarRegistrado, VENTANA_DIAS, type Candidato, type Par, type Pago } from ".";

type Ctx = Awaited<ReturnType<typeof obtenerContexto>>;

const COLUMNAS = "id, fecha, monto, tipo, estado, category_id, debt_id, recurring_rule_id, comercio";

/**
 * Movimientos del mismo tipo cerca de la fecha. Antes, si un pago fijo activo vence en esa ventana y aún no se
 * programó (se programan 7 días antes), se generan los del mes: así un pago adelantado encuentra su pendiente y el
 * cron no lo vuelve a crear después.
 */
export async function candidatosCerca(ctx: Ctx, tipo: Pago["tipo"], fecha: string): Promise<Candidato[]> {
  if (ctx.puedeEditar) {
    const { data: regla } = await ctx.supabase
      .from("recurring_rules")
      .select("id")
      .eq("activa", true)
      .eq("tipo", tipo)
      .lte("proxima_fecha", sumarDias(fecha, VENTANA_DIAS))
      .limit(1)
      .maybeSingle();
    if (regla) await ctx.supabase.rpc("generar_pagos_mes", { p_household: ctx.hogar.id });
  }
  const { data } = await ctx.supabase
    .from("transactions")
    .select(COLUMNAS)
    .eq("tipo", tipo)
    .gte("fecha", sumarDias(fecha, -VENTANA_DIAS))
    .lte("fecha", sumarDias(fecha, VENTANA_DIAS))
    .limit(200);
  return (data ?? []) as Candidato[];
}

/** Busca el par del pago en la base (ver `buscarPar`). */
export async function conciliar(ctx: Ctx, pago: Pago, o: { soloPendientes?: boolean } = {}): Promise<Par | null> {
  if (pago.tipo === "transferencia") return null;
  return buscarPar(pago, await candidatosCerca(ctx, pago.tipo, pago.fecha), o);
}

export type DatosPago = {
  monto: number;
  fecha: string;
  /** Solo si se eligió o se leyó: si no, el pendiente conserva su cuenta. */
  account_id?: string | null;
  category_id?: string | null;
  debt_id?: string | null;
  comercio?: string | null;
  client_id?: string | null;
  tax_tag_id?: string | null;
};

/**
 * Aplica el par sobre el movimiento existente: confirma el pago fijo con el monto y la fecha reales, liga la deuda o
 * no hace nada si ya estaba. Devuelve el id que queda y una frase para la familia.
 */
export async function aplicarPar(ctx: Ctx, par: Par, d: DatosPago): Promise<{ id: string; texto: string }> {
  const c = par.candidato;
  const nombre = c.comercio || "el movimiento";
  const debt_id = c.debt_id ?? d.debt_id ?? null;
  const category_id = c.category_id ?? d.category_id ?? null;
  if (par.motivo === "pago_fijo") {
    const { error } = await ctx.supabase
      .from("transactions")
      .update({
        estado: "confirmado",
        monto: d.monto,
        fecha: d.fecha,
        debt_id,
        category_id,
        ...(d.account_id ? { account_id: d.account_id } : {}),
        ...(d.client_id ? { client_id: d.client_id } : {}),
        ...(d.tax_tag_id ? { tax_tag_id: d.tax_tag_id } : {}),
      })
      .eq("id", c.id);
    if (error) throw new Error(mensajeError(error));
    const cambio = d.monto !== c.monto ? ` (estaba en ${formatearCOP(c.monto)})` : "";
    return { id: c.id, texto: `Era el pago fijo «${nombre}» del ${formatearDia(c.fecha)}: lo marqué como pagado por ${formatearCOP(d.monto)}${cambio}, sin duplicarlo.` };
  }
  if (debt_id !== c.debt_id || category_id !== c.category_id) {
    const { error } = await ctx.supabase.from("transactions").update({ debt_id, category_id }).eq("id", c.id);
    if (error) throw new Error(mensajeError(error));
  }
  return par.motivo === "ligar_deuda"
    ? { id: c.id, texto: `Ya estaba registrado como «${nombre}» del ${formatearDia(c.fecha)}: lo dejé como abono a la deuda, sin duplicarlo.` }
    : { id: c.id, texto: `Ya estaba registrado (${nombre} del ${formatearDia(c.fecha)}): no lo dupliqué.` };
}

/**
 * Marcar un pago fijo como pagado. Si ese pago ya se había registrado (comprobante, a mano o importado), se unen:
 * queda el registrado —con sus soportes— ligado al pago fijo y a su deuda, y el pendiente se borra.
 */
export async function confirmarPendiente(ctx: Ctx, id: string): Promise<{ ok: boolean; texto: string }> {
  const { data: pendiente } = await ctx.supabase.from("transactions").select(COLUMNAS).eq("id", id).maybeSingle();
  if (!pendiente) return { ok: false, texto: "" };
  if (pendiente.estado === "programado" && pendiente.tipo !== "transferencia") {
    const { data } = await ctx.supabase
      .from("transactions")
      .select(COLUMNAS)
      .eq("tipo", pendiente.tipo)
      .eq("estado", "confirmado")
      .is("recurring_rule_id", null)
      .gte("fecha", sumarDias(pendiente.fecha, -VENTANA_DIAS))
      .lte("fecha", sumarDias(pendiente.fecha, VENTANA_DIAS))
      .limit(200);
    const registrado = buscarRegistrado(pendiente as Candidato, (data ?? []) as Candidato[]);
    if (registrado) {
      const { error } = await ctx.supabase
        .from("transactions")
        .update({
          recurring_rule_id: pendiente.recurring_rule_id,
          debt_id: registrado.debt_id ?? pendiente.debt_id,
          category_id: registrado.category_id ?? pendiente.category_id,
        })
        .eq("id", registrado.id);
      if (error) throw new Error(mensajeError(error));
      const borrado = await ctx.supabase.from("transactions").delete().eq("id", pendiente.id).select("id");
      if (borrado.error) throw new Error(mensajeError(borrado.error));
      return {
        ok: true,
        texto: `Ya estaba registrado (${registrado.comercio || "movimiento"} del ${formatearDia(registrado.fecha)}, ${formatearCOP(registrado.monto)}): lo uní con este pago fijo, sin duplicarlo.`,
      };
    }
  }
  const { data, error } = await ctx.supabase.from("transactions").update({ estado: "confirmado" }).eq("id", id).select("id");
  if (error) throw new Error(mensajeError(error));
  return { ok: data.length > 0, texto: "Confirmado." };
}
