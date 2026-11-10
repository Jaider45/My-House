"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { mensajeError, SOLO_ADMIN, type Estado } from "@/lib/acciones";
import { obtenerContexto } from "@/lib/sesion";
import { urlCheckout } from "@/lib/pagos/wompi";
import { obtenerWompi } from "@/lib/pagos/servidor";
import { sitio } from "@/lib/correo/enviar";

/*
 * Plan del hogar (Configuración → Plan). Permiso primero (decisión 28); la base vuelve a exigir admin. El pago
 * nunca se confirma aquí: la acción crea el cobro y manda al Web Checkout de Wompi; el webhook lo da por pagado.
 */

const eleccion = z.object({
  plan: z.string().regex(/^[a-z][a-z_]{1,30}$/, "Plan no válido."),
  periodo: z.enum(["mensual", "anual"], "Elige pago mensual o anual."),
  cupon: z
    .string()
    .trim()
    .max(30)
    .transform((v) => v.toUpperCase())
    .optional(),
});

const SIN_PAGOS = "Los pagos aún no están disponibles. Escríbenos y te ayudamos.";
const volver = () => `${sitio()}/ajustes/plan`;

function refrescar() {
  // El plan cambia lo que muestran Metas, Presupuesto y el asistente.
  revalidatePath("/", "layout");
}

export async function iniciarPrueba(): Promise<Estado> {
  const ctx = await obtenerContexto();
  if (!ctx.esAdmin) return { error: SOLO_ADMIN };
  const { error } = await ctx.supabase.rpc("iniciar_prueba", { p_hogar: ctx.hogar.id });
  if (error) return { error: mensajeError(error) };
  refrescar();
  return { ok: "Listo: tienes el plan Familia de prueba." };
}

export type Cotizacion = { error?: string; precio?: number; descuento?: number; monto?: number; cupon?: string | null; cupon_descripcion?: string | null };

export async function cotizar(plan: string, periodo: string, cupon: string): Promise<Cotizacion> {
  const r = eleccion.safeParse({ plan, periodo, cupon });
  if (!r.success) return { error: r.error.issues[0].message };
  const ctx = await obtenerContexto();
  if (!ctx.esAdmin) return { error: SOLO_ADMIN };
  const { data, error } = await ctx.supabase.rpc("cotizar_plan", { p_hogar: ctx.hogar.id, p_plan: r.data.plan, p_periodo: r.data.periodo, p_cupon: r.data.cupon || undefined });
  if (error) return { error: mensajeError(error) };
  return data as Cotizacion;
}

export async function pagar(_: Estado, datos: FormData): Promise<Estado> {
  const ctx = await obtenerContexto();
  if (!ctx.esAdmin) return { error: SOLO_ADMIN };
  const r = eleccion.safeParse({ plan: datos.get("plan"), periodo: datos.get("periodo"), cupon: datos.get("cupon") ?? undefined });
  if (!r.success) return { error: r.error.issues[0].message };
  const wompi = await obtenerWompi();

  // Sin pasarela solo se puede usar un cupón que deje el cobro en $0 (crear_cobro lo activa de una vez).
  if (!wompi) {
    const q = await ctx.supabase.rpc("cotizar_plan", { p_hogar: ctx.hogar.id, p_plan: r.data.plan, p_periodo: r.data.periodo, p_cupon: r.data.cupon || undefined });
    if (q.error) return { error: mensajeError(q.error) };
    if ((q.data as { monto: number }).monto > 0) return { error: SIN_PAGOS };
  }

  const { data, error } = await ctx.supabase.rpc("crear_cobro", { p_hogar: ctx.hogar.id, p_plan: r.data.plan, p_periodo: r.data.periodo, p_cupon: r.data.cupon || undefined });
  if (error) return { error: mensajeError(error) };
  const cobro = data as { referencia: string; monto: number; activado: boolean };
  if (cobro.activado) {
    refrescar();
    return { ok: "Listo: tu hogar ya tiene el plan. El cupón cubrió el pago." };
  }
  redirect(urlCheckout(wompi!, { referencia: cobro.referencia, monto: cobro.monto, email: ctx.email, nombre: ctx.miembro.nombre, redireccion: volver() }));
}

/** Pagar un cobro que quedó pendiente (renovación o un pago que no se terminó). */
export async function pagarPendiente(): Promise<Estado> {
  const ctx = await obtenerContexto();
  if (!ctx.esAdmin) return { error: SOLO_ADMIN };
  const wompi = await obtenerWompi();
  if (!wompi) return { error: SIN_PAGOS };
  const { data, error } = await ctx.supabase.rpc("cobro_pendiente", { p_hogar: ctx.hogar.id });
  if (error) return { error: mensajeError(error) };
  const c = data as { referencia: string; monto: number } | null;
  if (!c) return { error: "No tienes pagos pendientes." };
  redirect(urlCheckout(wompi, { referencia: c.referencia, monto: c.monto, email: ctx.email, nombre: ctx.miembro.nombre, redireccion: volver() }));
}

export async function cambiarRenovacion(_: Estado, datos: FormData): Promise<Estado> {
  const ctx = await obtenerContexto();
  if (!ctx.esAdmin) return { error: SOLO_ADMIN };
  const renovar = datos.get("renovar") === "si";
  const { error } = await ctx.supabase.rpc("cancelar_al_vencer", { p_hogar: ctx.hogar.id, p_cancelar: !renovar });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/ajustes/plan");
  return { ok: renovar ? "Tu plan se seguirá renovando." : "Listo: al vencer pasarás al plan Gratis." };
}
