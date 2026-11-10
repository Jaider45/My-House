import { NextResponse, type NextRequest } from "next/server";
import { avisarAdministradores, crearClienteServicio, cronAutorizado } from "@/lib/pagos/servidor";
import { correoMora, correoPlanGratis, correoPruebaTermina, correoRenovacion } from "@/lib/correo/correos";
import type { Contenido } from "@/lib/correo/plantilla";
import { sitio } from "@/lib/correo/enviar";
import { formatearCOP } from "@/lib/dinero";
import { hoy as hoyBogota } from "@/lib/fechas";
import { formatearFechaCorta } from "@/lib/consola/formato";

export const maxDuration = 300;

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
 * veces. `?hoy=AAAA-MM-DD` simula otra fecha fuera de producción (o con AVISOS_SIMULAR_FECHA=1).
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

  console.log("[cobros]", hoy, JSON.stringify(resumen));
  return NextResponse.json({ hoy, ...resumen });
}
