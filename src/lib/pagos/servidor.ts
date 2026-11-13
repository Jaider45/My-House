import "server-only";
import { avisarEquipo } from "@/lib/consola/avisos-equipo";
import { createHash, timingSafeEqual } from "node:crypto";
import { crearClienteServicio, type Servicio } from "@/lib/supabase/servicio";
import { enviarCorreo } from "@/lib/correo/enviar";
import type { Contenido } from "@/lib/correo/plantilla";
import { leerIntegracion } from "@/lib/integraciones/servidor";
import { after } from "next/server";
import { correoPagoRecibido } from "@/lib/correo/correos";
import { sitio } from "@/lib/correo/enviar";
import { formatearCOP } from "@/lib/dinero";
import { formatearFechaCorta } from "@/lib/consola/formato";
import { apiWompi, describirMetodo, firmaIntegridad, type ConfigWompi, type TransaccionWompi } from "./wompi";

/*
 * Piezas de servidor de los cobros. La llave service_role solo la usan el webhook de Wompi (/api/pagos/wompi) y el
 * cron de vencimientos (/api/cobros): confirman pagos y cambian planes, cosas que ningún usuario puede hacer.
 */

export { crearClienteServicio, type Servicio };

/** Wompi conectado en la consola (Integraciones) o por variables de entorno. null = no se puede cobrar. */
export async function obtenerWompi(): Promise<ConfigWompi | null> {
  const w = await leerIntegracion("wompi");
  return w ? { publica: w.valores.llave_publica, integridad: w.valores.integridad, eventos: w.valores.eventos, privada: w.valores.privada || undefined } : null;
}

/** API de Wompi según la llave (sandbox o producción). `WOMPI_API_URL` la reemplaza en las pruebas (servidor falso). */
export const baseWompi = (publica: string) => process.env.WOMPI_API_URL || apiWompi(publica);

/** Compara `Authorization` con `Bearer <secreto>` en tiempo constante (Vercel Cron manda CRON_SECRET). */
export function cronAutorizado(encabezado: string | null, secreto: string | undefined): boolean {
  if (!secreto) return false;
  const a = createHash("sha256").update(encabezado ?? "").digest();
  const b = createHash("sha256").update(`Bearer ${secreto}`).digest();
  return timingSafeEqual(a, b);
}

/** Transacción según Wompi (endpoint público, sin llave privada). null si no existe o Wompi no responde. */
export async function consultarTransaccion(id: string, llavePublica: string): Promise<TransaccionWompi | null> {
  if (!/^[\w-]{6,80}$/.test(id)) return null;
  try {
    const r = await fetch(`${baseWompi(llavePublica)}/transactions/${encodeURIComponent(id)}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    return ((await r.json()) as { data?: TransaccionWompi }).data ?? null;
  } catch {
    return null;
  }
}

/** Administradores del hogar con su correo (para los avisos de cobro). */
export async function administradores(db: Servicio, hogar: string): Promise<{ nombre: string; email: string; hogar: string }[]> {
  const { data: miembros } = await db.from("members").select("nombre, user_id, households(nombre)").eq("household_id", hogar).eq("rol", "admin");
  const ids = (miembros ?? []).map((m) => m.user_id).filter((x): x is string => Boolean(x));
  if (!ids.length) return [];
  const { data: correos } = await db.rpc("correos_de_usuarios", { p_ids: ids });
  const porId = new Map((correos ?? []).map((c) => [c.id, c.email]));
  return (miembros ?? [])
    .filter((m) => m.user_id && porId.get(m.user_id))
    .map((m) => ({ nombre: m.nombre.split(/\s+/)[0], email: porId.get(m.user_id!)!, hogar: m.households?.nombre ?? "tu hogar" }));
}

/** Envía un correo a cada administrador. Devuelve cuántos salieron. Nunca lanza. */
export async function avisarAdministradores(
  db: Servicio,
  hogar: string,
  etiqueta: string,
  armar: (a: { nombre: string; hogar: string }) => Contenido,
): Promise<number> {
  let enviados = 0;
  for (const a of await administradores(db, hogar)) {
    const r = await enviarCorreo({ para: a.email, etiqueta, contenido: armar(a) });
    if (r.enviado) enviados++;
  }
  return enviados;
}

// ───────────────────────────── pago dentro de la app ─────────────────────────────

export type Aceptacion = { aceptacion: string; datos: string; terminos: string; datosUrl: string };

/** Tokens de aceptación vigentes del comercio (reglamento de Wompi y autorización de datos personales). */
export async function aceptacionWompi(c: ConfigWompi): Promise<Aceptacion | null> {
  try {
    const r = await fetch(`${baseWompi(c.publica)}/merchants/${encodeURIComponent(c.publica)}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const d = ((await r.json()) as { data?: Record<string, { acceptance_token?: string; permalink?: string } | undefined> }).data;
    const a = d?.presigned_acceptance;
    const p = d?.presigned_personal_data_auth;
    if (!a?.acceptance_token) return null;
    return { aceptacion: a.acceptance_token, datos: p?.acceptance_token ?? "", terminos: a.permalink ?? "", datosUrl: p?.permalink ?? "" };
  } catch {
    return null;
  }
}

type ErrorWompi = { error?: { type?: string; reason?: string; messages?: Record<string, string[]> } };
const motivo = (d: ErrorWompi) => d.error?.reason ?? (d.error?.messages ? Object.values(d.error.messages).flat()[0] : null) ?? "Wompi no aceptó la solicitud.";

/** Guarda la tarjeta en Wompi (fuente de pago) para cobrar las renovaciones. Requiere la llave privada. */
export async function crearFuentePago(c: ConfigWompi, d: { token: string; email: string; aceptacion: Aceptacion }): Promise<{ id: number } | { error: string }> {
  if (!c.privada) return { error: "Guardar la tarjeta aún no está disponible." };
  try {
    const r = await fetch(`${baseWompi(c.publica)}/payment_sources`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${c.privada}` },
      body: JSON.stringify({ type: "CARD", token: d.token, customer_email: d.email, acceptance_token: d.aceptacion.aceptacion, accept_personal_auth: d.aceptacion.datos || undefined }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const j = (await r.json().catch(() => ({}))) as { data?: { id?: number; status?: string } } & ErrorWompi;
    if (!r.ok || !j.data?.id) return { error: motivo(j) };
    return { id: j.data.id };
  } catch {
    return { error: "No pudimos conectar con la pasarela de pagos." };
  }
}

export type MedioPago = { tipo: "tarjeta"; token: string; cuotas: number } | { tipo: "nequi"; telefono: string } | { tipo: "fuente"; fuente: number; cuotas: number };

/**
 * Crea la transacción en Wompi. Tarjeta nueva o Nequi: con la llave pública; con una fuente de pago guardada: con
 * la privada. La firma de integridad amarra referencia, monto y moneda.
 */
export async function crearTransaccion(
  c: ConfigWompi,
  d: { referencia: string; monto: number; email: string; nombre?: string; medio: MedioPago; aceptacion: Aceptacion },
): Promise<TransaccionWompi | { error: string }> {
  const centavos = d.monto * 100;
  const cuerpo: Record<string, unknown> = {
    amount_in_cents: centavos,
    currency: "COP",
    reference: d.referencia,
    customer_email: d.email,
    signature: firmaIntegridad(d.referencia, centavos, c.integridad),
    acceptance_token: d.aceptacion.aceptacion,
    ...(d.aceptacion.datos ? { accept_personal_auth: d.aceptacion.datos } : {}),
    ...(d.nombre ? { customer_data: { full_name: d.nombre } } : {}),
  };
  let llave = c.publica;
  if (d.medio.tipo === "tarjeta") cuerpo.payment_method = { type: "CARD", token: d.medio.token, installments: d.medio.cuotas };
  else if (d.medio.tipo === "nequi") cuerpo.payment_method = { type: "NEQUI", phone_number: d.medio.telefono };
  else {
    if (!c.privada) return { error: "Cobrar con la tarjeta guardada aún no está disponible." };
    llave = c.privada;
    cuerpo.payment_source_id = d.medio.fuente;
    cuerpo.payment_method = { installments: d.medio.cuotas };
    cuerpo.recurrent = true;
  }
  try {
    const r = await fetch(`${baseWompi(c.publica)}/transactions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${llave}` },
      body: JSON.stringify(cuerpo),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const j = (await r.json().catch(() => ({}))) as { data?: TransaccionWompi } & ErrorWompi;
    if (!r.ok || !j.data?.id) return { error: motivo(j) };
    return j.data;
  } catch {
    return { error: "No pudimos conectar con la pasarela de pagos." };
  }
}

export type ResultadoPago = { resultado: string; hogar?: string; plan?: string; periodo?: string; monto?: number; referencia?: string };

/**
 * Registra el estado de una transacción leída de Wompi (webhook o consulta mientras la persona espera). Idempotente
 * por `transacción:estado`; la base exige el monto exacto. Si queda aplicado, el recibo sale por correo después.
 */
export async function procesarTransaccion(db: Servicio, t: TransaccionWompi, payload: unknown): Promise<ResultadoPago | { error: string }> {
  const { metodo, detalle } = describirMetodo(t);
  const { data, error } = await db.rpc("registrar_pago_wompi", {
    p_evento: `${t.id}:${t.status}`,
    p_referencia: t.reference,
    p_transaccion: t.id,
    p_estado: t.status,
    p_monto_centavos: t.amount_in_cents,
    p_metodo: metodo,
    p_detalle: detalle ?? "",
    p_payload: payload as Record<string, never>,
  });
  if (error) return { error: error.message };
  const r = data as ResultadoPago;
  if (r.resultado === "aplicado" && r.hogar) {
    const hogar = r.hogar;
    after(async () => {
      const [{ data: s }, { data: p }] = await Promise.all([
        db.from("suscripciones").select("vence").eq("household_id", hogar).single(),
        db.from("planes").select("nombre").eq("codigo", r.plan!).single(),
      ]);
      await avisarAdministradores(db, hogar, "pago-recibido", (a) =>
        correoPagoRecibido({
          nombre: a.nombre,
          hogar: a.hogar,
          plan: p?.nombre ?? "Familia",
          periodo: r.periodo === "anual" ? "anual" : "mensual",
          monto: formatearCOP(r.monto ?? 0),
          hasta: formatearFechaCorta(s ? `${s.vence}T12:00:00-05:00` : null),
          metodo: [metodo, detalle].filter(Boolean).join(" ") || null,
          referencia: r.referencia ?? t.reference,
          urlPlan: `${sitio()}/ajustes/plan`,
          sitio: sitio(),
        }),
      );
    });
  }
  // Ajustes de la plataforma → Avisos para el equipo: un pago rechazado de un hogar.
  if ((t.status === "DECLINED" || t.status === "ERROR") && r.hogar) {
    const hogar = r.hogar;
    after(async () => {
      const { data: h } = await db.from("households").select("nombre").eq("id", hogar).single();
      await avisarEquipo(db, "pago_fallido", t.id, {
        titulo: `Pago fallido · ${h?.nombre ?? "un hogar"}`,
        texto: `Wompi rechazó el cobro ${t.reference} por ${formatearCOP(Math.round(t.amount_in_cents / 100))} (${[metodo, detalle].filter(Boolean).join(" ") || "sin método"}).`,
        ruta: `/consola/hogares/${hogar}`,
      });
    });
  }
  return r;
}
