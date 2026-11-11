import { NextResponse, type NextRequest } from "next/server";
import { administradores, avisarAdministradores, crearClienteServicio, cronAutorizado } from "@/lib/pagos/servidor";
import { correoCampana, correoMora, correoPlanGratis, correoPruebaTermina, correoRenovacion } from "@/lib/correo/correos";
import type { Contenido } from "@/lib/correo/plantilla";
import { enviarCorreo, sitio } from "@/lib/correo/enviar";
import { formatearCOP } from "@/lib/dinero";
import { hoy as hoyBogota } from "@/lib/fechas";
import { formatearFechaCorta } from "@/lib/consola/formato";

export const maxDuration = 300;

/** Correos por segundo al enviar campañas (límite de Resend; igual que /api/avisos). */
const CORREOS_POR_SEGUNDO = Math.max(1, Number(process.env.AVISOS_CORREOS_POR_SEGUNDO) || 2);
/** Tope de tiempo para las campañas: deja margen antes de que Vercel corte la función (maxDuration). */
const LIMITE_CAMPANAS_MS = 240_000;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Campana = { id: string; asunto: string; titulo: string; cuerpo: string; boton_texto: string | null; boton_url: string | null };

type Aviso = {
  tipo: "renovacion" | "mora" | "gratis" | "cancelada" | "prueba";
  hogar: string;
  plan?: string;
  periodo?: string;
  vence?: string;
  baja?: string;
  hasta?: string;
  dia?: number;
  monto?: number | null;
};

const fecha = (d?: string) => formatearFechaCorta(d ? (d.length === 10 ? `${d}T12:00:00-05:00` : d) : null);

/**
 * Vencimientos de los planes (Vercel Cron, todos los días a las 7:15 a. m. de Bogotá, `Authorization: Bearer
 * $CRON_SECRET`). `procesar_vencimientos` hace los cambios (renovación, mora, baja a Gratis) y devuelve los avisos;
 * aquí se envían por correo a los administradores. `avisos_enviados` evita repetir un correo si el cron corre dos
 * veces. También envía las campañas programadas (consola → Comunicaciones). `?hoy=AAAA-MM-DD` simula otra fecha
 * fuera de producción (o con AVISOS_SIMULAR_FECHA=1).
 */
export async function GET(request: NextRequest) {
  if (!cronAutorizado(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const arranque = Date.now();
  const simular = process.env.NODE_ENV !== "production" || process.env.AVISOS_SIMULAR_FECHA === "1";
  const pedido = request.nextUrl.searchParams.get("hoy");
  const hoy = simular && pedido && /^\d{4}-\d{2}-\d{2}$/.test(pedido) ? pedido : hoyBogota();

  const db = crearClienteServicio();
  const { data, error } = await db.rpc("procesar_vencimientos", { p_hoy: hoy });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const avisos = (data ?? []) as Aviso[];

  const { data: planes } = await db.from("planes").select("codigo, nombre, precio_mensual");
  const plan = new Map((planes ?? []).map((p) => [p.codigo, p]));
  const urlPlan = `${sitio()}/ajustes/plan`;
  const resumen = { avisos: avisos.length, correos: 0, repetidos: 0 };

  for (const a of avisos) {
    const clave = `cobro:${a.tipo}:${a.vence ?? a.hasta?.slice(0, 10) ?? hoy}${a.dia ? `:${a.dia}` : ""}`;
    const { data: nuevo } = await db
      .from("avisos_enviados")
      .upsert({ household_id: a.hogar, clave, tipo: `cobro_${a.tipo}` }, { onConflict: "household_id,clave", ignoreDuplicates: true })
      .select("clave");
    if (!nuevo?.length) {
      resumen.repetidos++;
      continue;
    }
    const nombrePlan = plan.get(a.plan ?? "")?.nombre ?? "Familia";
    const armar = (d: { nombre: string; hogar: string }): Contenido => {
      const base = { nombre: d.nombre, hogar: d.hogar, plan: nombrePlan, urlPlan, sitio: sitio() };
      switch (a.tipo) {
        case "renovacion":
          return correoRenovacion({ ...base, monto: formatearCOP(a.monto ?? 0), vence: fecha(a.vence), periodo: a.periodo === "anual" ? "Anual" : "Mensual" });
        case "mora":
          return correoMora({ ...base, monto: a.monto ? formatearCOP(a.monto) : null, vencio: fecha(a.vence), baja: fecha(a.baja), dia: a.dia ?? 1 });
        case "prueba":
          return correoPruebaTermina({ ...base, plan: "Familia", hasta: fecha(a.hasta), precio: formatearCOP(plan.get("familia")?.precio_mensual ?? 0) });
        default:
          return correoPlanGratis({ ...base, motivo: a.tipo === "gratis" ? "mora" : "cancelada" });
      }
    };
    const enviados = await avisarAdministradores(db, a.hogar, `cobro-${a.tipo}`, armar);
    resumen.correos += enviados;
    await db.from("avisos_enviados").update({ destinatarios: enviados }).eq("household_id", a.hogar).eq("clave", clave);
  }

  // ── Campañas programadas (consola → Comunicaciones) ──
  // Una campaña grande se envía por tandas: `campana_reclamar` toma una, se envía mientras quede tiempo y
  // `campana_avance` guarda hasta dónde llegó. La siguiente corrida sigue desde ahí, sin repetir a nadie.
  const campanas = { enviadas: 0, correos: 0, pendientes: 0 };
  // Máximo 5 campañas por corrida. Ojo: una función SQL que devuelve un registro compuesto responde, cuando no hay
  // nada, un objeto con todos los campos en null (no null): sin el chequeo de `id` el ciclo no terminaba nunca.
  for (let n = 0; n < 5 && Date.now() - arranque < LIMITE_CAMPANAS_MS; n++) {
    const { data: reclamada, error: eReclamar } = await db.rpc("campana_reclamar");
    const c = reclamada as unknown as Campana | null;
    if (eReclamar || !c?.id) break;
    const { data: hogares } = await db.rpc("campana_hogares", { p_campana: c.id });
    const pendientes = (hogares ?? []) as string[];
    let enviados = 0;
    let alcance = 0;
    let cursor: string | null = null;
    for (const h of pendientes) {
      if (Date.now() - arranque > LIMITE_CAMPANAS_MS) break;
      for (const a of await administradores(db, h)) {
        const r = await enviarCorreo({
          para: a.email,
          etiqueta: "campana",
          contenido: correoCampana({ nombre: a.nombre, asunto: c.asunto, titulo: c.titulo, cuerpo: c.cuerpo, botonTexto: c.boton_texto, botonUrl: c.boton_url, sitio: sitio() }),
        });
        if (r.enviado) enviados++;
        await esperar(Math.ceil(1000 / CORREOS_POR_SEGUNDO));
      }
      cursor = h;
      alcance++;
    }
    const termino = alcance === pendientes.length;
    await db.rpc("campana_avance", { p_id: c.id, p_cursor: cursor as string, p_enviados: enviados, p_alcance: alcance, p_termino: termino });
    campanas.correos += enviados;
    if (termino) campanas.enviadas++;
    else campanas.pendientes++;
    if (!termino) break; // se acabó el tiempo: lo que falta sale en la siguiente corrida
  }

  // Retención (Ley 1581): el detalle de correos y el registro técnico se borran a los 90 días.
  const { data: purgados } = await db.rpc("purgar_retencion");
  console.info("[cobros]", hoy, JSON.stringify({ ...resumen, campanas, purgados }));
  return NextResponse.json({ hoy, ...resumen, campanas, purgados });
}
