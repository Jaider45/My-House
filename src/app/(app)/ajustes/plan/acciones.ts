"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mensajeError, SOLO_ADMIN, type Estado } from "@/lib/acciones";
import { obtenerContexto } from "@/lib/sesion";
import { referenciaIntento, type TransaccionWompi } from "@/lib/pagos/wompi";
import {
  aceptacionWompi,
  consultarTransaccion,
  crearClienteServicio,
  crearFuentePago,
  crearTransaccion,
  obtenerWompi,
  procesarTransaccion,
  type MedioPago,
} from "@/lib/pagos/servidor";

/*
 * Plan del hogar (Configuración → Plan). El pago se hace aquí mismo, sin salir de My House:
 *  1. El navegador tokeniza la tarjeta directamente con Wompi (la tarjeta nunca pasa por este servidor).
 *  2. `pagarEnApp` crea el cobro en la base y la transacción en Wompi (con el token, con Nequi o con la tarjeta
 *     guardada). Si la persona eligió guardarla, antes la convierte en fuente de pago para renovar solo.
 *  3. La pantalla pregunta con `revisarPago` hasta que Wompi responda; esa consulta (o el webhook, lo que llegue
 *     primero) registra el resultado en la base, que solo da por pagado el monto exacto.
 * Permiso primero (decisión 28); la base vuelve a exigir admin.
 */

const SIN_PAGOS = "Los pagos aún no están disponibles. Escríbenos y te ayudamos.";

const plan = z.object({
  plan: z.string().regex(/^[a-z][a-z_]{1,30}$/, "Plan no válido."),
  periodo: z.enum(["mensual", "anual"], "Elige pago mensual o anual."),
  cupon: z
    .string()
    .trim()
    .max(30)
    .transform((v) => v.toUpperCase())
    .optional(),
});

const medio = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("tarjeta"),
    token: z.string().regex(/^tok_[\w-]{4,120}$/, "La tarjeta no se validó. Intenta de nuevo."),
    marca: z.string().max(30).default(""),
    ultimos4: z.string().regex(/^\d{4}$/).or(z.literal("")).default(""),
    vence: z.string().regex(/^\d{2}\/\d{2}$/).or(z.literal("")).default(""),
    titular: z.string().trim().max(80).default(""),
    cuotas: z.coerce.number().int().min(1).max(36).default(1),
    guardar: z.boolean().default(false),
  }),
  z.object({ tipo: z.literal("nequi"), telefono: z.string().transform((v) => v.replace(/\D/g, "")).pipe(z.string().regex(/^3\d{9}$/, "Escribe el celular de Nequi (10 dígitos).")) }),
  z.object({ tipo: z.literal("guardada"), cuotas: z.coerce.number().int().min(1).max(36).default(1) }),
]);

const entrada = z.object({
  cobro: z.union([plan, z.literal("pendiente")]),
  medio,
  acepta: z.literal(true, "Para pagar acepta el reglamento de Wompi y la autorización de datos."),
});

export type EntradaPago = z.input<typeof entrada>;
export type RespuestaPago = { error: string } | { activado: true; ok: string } | { transaccion: string; estado: string };

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

export async function cotizar(planElegido: string, periodo: string, cupon: string): Promise<Cotizacion> {
  const r = plan.safeParse({ plan: planElegido, periodo, cupon });
  if (!r.success) return { error: r.error.issues[0].message };
  const ctx = await obtenerContexto();
  if (!ctx.esAdmin) return { error: SOLO_ADMIN };
  const { data, error } = await ctx.supabase.rpc("cotizar_plan", { p_hogar: ctx.hogar.id, p_plan: r.data.plan, p_periodo: r.data.periodo, p_cupon: r.data.cupon || undefined });
  if (error) return { error: mensajeError(error) };
  return data as Cotizacion;
}

/** Activa un plan con un cupón que lo deja en $0 (no necesita pasarela). */
export async function activarConCupon(_: Estado, datos: FormData): Promise<Estado> {
  const ctx = await obtenerContexto();
  if (!ctx.esAdmin) return { error: SOLO_ADMIN };
  const r = plan.safeParse({ plan: datos.get("plan"), periodo: datos.get("periodo"), cupon: datos.get("cupon") ?? undefined });
  if (!r.success) return { error: r.error.issues[0].message };
  const q = await ctx.supabase.rpc("cotizar_plan", { p_hogar: ctx.hogar.id, p_plan: r.data.plan, p_periodo: r.data.periodo, p_cupon: r.data.cupon || undefined });
  if (q.error) return { error: mensajeError(q.error) };
  if ((q.data as { monto: number }).monto > 0) return { error: "Ese cupón no cubre todo el valor: paga la diferencia con tarjeta o Nequi." };
  const { error } = await ctx.supabase.rpc("crear_cobro", { p_hogar: ctx.hogar.id, p_plan: r.data.plan, p_periodo: r.data.periodo, p_cupon: r.data.cupon || undefined });
  if (error) return { error: mensajeError(error) };
  refrescar();
  return { ok: "Listo: tu hogar ya tiene el plan. El cupón cubrió el pago." };
}

/** Cobra el plan (o un cobro pendiente) dentro de la app. Ver el comentario del archivo. */
export async function pagarEnApp(datos: EntradaPago): Promise<RespuestaPago> {
  const ctx = await obtenerContexto();
  if (!ctx.esAdmin) return { error: SOLO_ADMIN };
  const r = entrada.safeParse(datos);
  if (!r.success) return { error: r.error.issues[0].message };
  const wompi = await obtenerWompi();
  if (!wompi) return { error: SIN_PAGOS };
  const m = r.data.medio;
  if ((m.tipo === "guardada" || (m.tipo === "tarjeta" && m.guardar)) && !wompi.privada) return { error: "Guardar la tarjeta aún no está disponible. Paga sin guardarla." };

  // Aceptación de Wompi y medio guardado, en paralelo con la creación del cobro.
  const [aceptacion, guardado, cobro] = await Promise.all([
    aceptacionWompi(wompi),
    m.tipo === "guardada"
      ? ctx.supabase.from("metodos_pago").select("id, fuente_id").eq("household_id", ctx.hogar.id).eq("activo", true).maybeSingle()
      : Promise.resolve({ data: null }),
    r.data.cobro === "pendiente"
      ? ctx.supabase.rpc("cobro_pendiente", { p_hogar: ctx.hogar.id })
      : ctx.supabase.rpc("crear_cobro", { p_hogar: ctx.hogar.id, p_plan: r.data.cobro.plan, p_periodo: r.data.cobro.periodo, p_cupon: r.data.cobro.cupon || undefined }),
  ]);
  if (cobro.error) return { error: mensajeError(cobro.error) };
  const c = cobro.data as { referencia: string; monto: number; intentos?: number; activado?: boolean } | null;
  if (!c) return { error: "No tienes pagos pendientes." };
  if (c.activado) {
    refrescar();
    return { activado: true, ok: "Listo: tu hogar ya tiene el plan. El cupón cubrió el pago." };
  }
  if (!aceptacion) return { error: "La pasarela de pagos no responde. Intenta de nuevo en unos minutos." };

  const db = crearClienteServicio();
  let medioWompi: MedioPago;
  let metodoPago: string | null = null;
  if (m.tipo === "nequi") medioWompi = { tipo: "nequi", telefono: m.telefono };
  else if (m.tipo === "guardada") {
    const g = guardado.data as { id: string; fuente_id: number } | null;
    if (!g) return { error: "Ya no tienes una tarjeta guardada. Escribe los datos de la tarjeta." };
    medioWompi = { tipo: "fuente", fuente: g.fuente_id, cuotas: m.cuotas };
    metodoPago = g.id;
  } else if (m.guardar) {
    const f = await crearFuentePago(wompi, { token: m.token, email: ctx.email, aceptacion });
    if ("error" in f) return { error: `No pudimos guardar la tarjeta: ${f.error}` };
    const { data: id, error } = await db.rpc("guardar_metodo_pago", {
      p_hogar: ctx.hogar.id,
      p_fuente: f.id,
      p_tipo: "CARD",
      p_marca: m.marca,
      p_ultimos4: m.ultimos4,
      p_vence: m.vence,
      p_titular: m.titular,
      p_usuario: ctx.userId,
    });
    if (error) return { error: mensajeError(error) };
    medioWompi = { tipo: "fuente", fuente: f.id, cuotas: m.cuotas };
    metodoPago = id as string;
  } else medioWompi = { tipo: "tarjeta", token: m.token, cuotas: m.cuotas };

  const referencia = referenciaIntento(c.referencia, c.intentos ?? 0);
  const t = await crearTransaccion(wompi, { referencia, monto: c.monto, email: ctx.email, nombre: ctx.miembro.nombre, medio: medioWompi, aceptacion });
  if ("error" in t) return { error: `El pago no se pudo iniciar: ${t.error}` };
  await db.rpc("cobro_transaccion", { p_referencia: referencia, p_transaccion: t.id, p_metodo_pago: metodoPago as string });
  // Con tarjeta Wompi suele responder de una vez; si ya hay resultado, se registra sin esperar al webhook.
  if (t.status !== "PENDING") await procesarTransaccion(db, t, { origen: "app", transaction: t });
  refrescar();
  return { transaccion: t.id, estado: t.status };
}

export type EstadoPago = { estado: "APPROVED" | "PENDING" | "DECLINED" | "ERROR" | "VOIDED" | "DESCONOCIDO"; mensaje: string };

/** Lo que dice Wompi de una transacción del hogar. Si ya terminó, la registra (idempotente con el webhook). */
export async function revisarPago(id: string): Promise<EstadoPago> {
  const ctx = await obtenerContexto();
  if (!ctx.esAdmin) return { estado: "DESCONOCIDO", mensaje: SOLO_ADMIN };
  const wompi = await obtenerWompi();
  if (!wompi || !/^[\w-]{6,80}$/.test(id)) return { estado: "DESCONOCIDO", mensaje: "No encontramos ese pago." };
  const t: TransaccionWompi | null = await consultarTransaccion(id, wompi.publica);
  if (!t) return { estado: "PENDING", mensaje: "Esperando respuesta de la pasarela…" };
  // Solo transacciones de cobros de este hogar (RLS: el admin ve sus cobros).
  const { data: cobro } = await ctx.supabase.from("cobros").select("id").eq("household_id", ctx.hogar.id).eq("referencia", t.reference.split(".")[0]).maybeSingle();
  if (!cobro) return { estado: "DESCONOCIDO", mensaje: "No encontramos ese pago." };
  if (t.status !== "PENDING") {
    await procesarTransaccion(crearClienteServicio(), t, { origen: "app", transaction: t });
    refrescar();
  }
  switch (t.status) {
    case "APPROVED":
      return { estado: "APPROVED", mensaje: "¡Pago aprobado! Tu plan ya está activo y te enviamos el recibo por correo." };
    case "PENDING":
      return { estado: "PENDING", mensaje: "Esperando la aprobación…" };
    case "DECLINED":
      return { estado: "DECLINED", mensaje: `El pago fue rechazado${t.status_message ? `: ${t.status_message}` : ""}. Prueba con otra tarjeta o con Nequi.` };
    case "VOIDED":
      return { estado: "VOIDED", mensaje: "El pago se anuló." };
    default:
      return { estado: "ERROR", mensaje: `Hubo un error con el pago${t.status_message ? `: ${t.status_message}` : ""}. Intenta de nuevo.` };
  }
}

export async function quitarTarjeta(): Promise<Estado> {
  const ctx = await obtenerContexto();
  if (!ctx.esAdmin) return { error: SOLO_ADMIN };
  const { error } = await ctx.supabase.rpc("quitar_metodo_pago", { p_hogar: ctx.hogar.id });
  if (error) return { error: mensajeError(error) };
  revalidatePath("/ajustes/plan");
  return { ok: "Listo: quitamos la tarjeta. Las renovaciones las pagas tú desde aquí." };
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
