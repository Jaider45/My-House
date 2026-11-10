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
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

  // ── Campañas programadas (consola → Comunicaciones). Cada una se reclama una sola vez. ──
  const campanas = { enviadas: 0, correos: 0 };
  const { data: programadas } = await db
    .from("campanas")
    .select("id")
    .eq("estado", "programada")
    .lte("programada_para", new Date().toISOString())
    .limit(5);
  for (const { id } of programadas ?? []) {
    const { data: mia } = await db.from("campanas").update({ estado: "enviando" }).eq("id", id).eq("estado", "programada").select("*");
    const c = mia?.[0];
    if (!c) continue;
    const { data: hogares } = await db.rpc("campana_hogares", { p_campana: c.id });
    let enviados = 0;
    for (const h of hogares ?? []) {
      for (const a of await administradores(db, h)) {
        const r = await enviarCorreo({
          para: a.email,
          etiqueta: "campana",
          contenido: correoCampana({ nombre: a.nombre, asunto: c.asunto, titulo: c.titulo, cuerpo: c.cuerpo, botonTexto: c.boton_texto, botonUrl: c.boton_url, sitio: sitio() }),
        });
        if (r.enviado) enviados++;
        await esperar(Math.ceil(1000 / CORREOS_POR_SEGUNDO));
      }
    }
    await db
      .from("campanas")
      .update({ estado: "enviada", alcance: (hogares ?? []).length, enviados, enviada_en: new Date().toISOString() })
      .eq("id", c.id);
    campanas.enviadas++;
    campanas.correos += enviados;
  }

  console.log("[cobros]", hoy, JSON.stringify({ ...resumen, campanas }));
  return NextResponse.json({ hoy, ...resumen, campanas });
}
