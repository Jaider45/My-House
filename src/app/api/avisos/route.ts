import { after, NextResponse, type NextRequest } from "next/server";
import { planificarAvisos, type Aviso, type DatosHogar } from "@/lib/avisos";
import { enviarCorreo, sitio } from "@/lib/correo/enviar";
import { hoy as hoyBogota, sumarDias } from "@/lib/fechas";
import { leerConfigHogar } from "@/lib/hogar";
import { cargarSemaforo } from "@/lib/impuestos/servidor";
import { crearClienteServicio, hayServicio } from "@/lib/supabase/servicio";
import { cronAutorizado } from "@/lib/pagos/servidor";

/** Vercel corta la función a los `maxDuration` segundos (300 = tope con Fluid compute en Hobby y Pro). */
export const maxDuration = 300;

/** Hogares por página (también limita el largo de los filtros `in(...)` en la URL de PostgREST). */
const HOGARES_POR_PAGINA = Math.max(1, Number(process.env.AVISOS_HOGARES_POR_PAGINA) || 100);
/** Hogares que se preparan a la vez (cada uno hace varias consultas: semáforo, resumen). */
const HOGARES_EN_PARALELO = 10;
/** Correos por segundo: Resend limita las peticiones por segundo de la cuenta (2 por defecto). */
const CORREOS_POR_SEGUNDO = Math.max(1, Number(process.env.AVISOS_CORREOS_POR_SEGUNDO) || 2);
/** Después de esto no se preparan más hogares: lo que queda de tiempo es para enviar. */
const LIMITE_PREPARAR_MS = 120_000;
/** Después de esto no se envía más: se liberan las claves pendientes y otra invocación sigue. */
const LIMITE_ENVIAR_MS = 260_000;
/** Tope de invocaciones encadenadas en un día (evita un ciclo si el proveedor de correo está caído). */
const MAX_VUELTAS = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));


/**
 * Avisos programados por correo. Lo llama Vercel Cron cada día a las 7:00 a. m. de Bogotá (vercel.json) con
 * `Authorization: Bearer $CRON_SECRET`. Recorre los hogares por páginas, así que usa la llave service_role (solo
 * aquí, en el servidor). Qué sale y a quién lo decide `planificarAvisos`; lo ya enviado queda en avisos_enviados.
 *
 * Escala: prepara los hogares de a `HOGARES_EN_PARALELO`, reserva todas las claves en una sola consulta y envía
 * respetando `CORREOS_POR_SEGUNDO`. Si se acaba el tiempo o quedan hogares, se llama a sí misma con `?desde=`
 * (cursor por id de hogar). Es idempotente: lo ya reservado no se repite y lo no enviado se libera.
 *
 * `?hoy=AAAA-MM-DD` simula otra fecha (fuera de producción, o con AVISOS_SIMULAR_FECHA=1 para probar un build local).
 */
export async function GET(request: NextRequest) {
  const inicio = Date.now();
  if (!cronAutorizado(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hayServicio()) {
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }
  const db = crearClienteServicio();
  const params = request.nextUrl.searchParams;
  const simulado = params.get("hoy");
  const simular = process.env.NODE_ENV !== "production" || process.env.AVISOS_SIMULAR_FECHA === "1";
  const hoy = simulado && simular && /^\d{4}-\d{2}-\d{2}$/.test(simulado) ? simulado : hoyBogota();
  const desde = UUID.test(params.get("desde") ?? "") ? params.get("desde")! : null;
  const vuelta = Math.max(1, Number(params.get("vuelta")) || 1);
  const anio = Number(hoy.slice(0, 4));
  const lunes = new Date(`${hoy}T00:00:00Z`).getUTCDay() === 1;
  const ayer = sumarDias(hoy, -1);

  let consulta = db.from("households").select("id, nombre, pais, config").order("id").limit(HOGARES_POR_PAGINA + 1);
  if (desde) consulta = consulta.gt("id", desde);
  const { data: pagina, error: eHogares } = await consulta;
  if (eHogares) return NextResponse.json({ error: eHogares.message }, { status: 500 });
  const hayMas = pagina.length > HOGARES_POR_PAGINA;
  const hogares = pagina.slice(0, HOGARES_POR_PAGINA);
  const ids = hogares.map((h) => h.id);

  // Adultos que escriben (admin/editor), recordatorios por correo y pagos vencidos ayer: solo de esta página.
  const [miembros, recordatorios, vencidos] = ids.length
    ? await Promise.all([
        db.from("members").select("household_id, nombre, user_id, rol").in("household_id", ids).not("user_id", "is", null).in("rol", ["admin", "editor"]),
        db.from("reminders").select("id, household_id, nombre, fecha, monto, repetir, avisos, canales, activo").in("household_id", ids).eq("activo", true).contains("canales", ["correo"]),
        db
          .from("transactions")
          .select("id, household_id, comercio, monto, fecha, accounts!transactions_account_id_household_id_fkey(nombre), categories(nombre), recurring_rules(recordar)")
          .in("household_id", ids)
          .eq("estado", "programado")
          .eq("tipo", "gasto")
          .eq("fecha", ayer),
      ])
    : [];
  const fallo = [miembros, recordatorios, vencidos].find((r) => r?.error)?.error;
  if (fallo) return NextResponse.json({ error: fallo.message }, { status: 500 });

  // Correos de Auth solo de esas personas, en una llamada (antes: toda la lista de usuarios).
  const userIds = [...new Set((miembros?.data ?? []).map((m) => m.user_id!))];
  const correos = new Map<string, string>();
  if (userIds.length) {
    const { data, error } = await db.rpc("correos_de_usuarios", { p_ids: userIds });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const u of data) correos.set(u.id, u.email);
  }

  const resumen = { hogares: 0, avisos: 0, correos: 0, fallidos: 0, repetidos: 0, liberados: 0 };

  /** Arma los datos de un hogar y decide sus avisos. */
  async function preparar(h: (typeof hogares)[number]): Promise<{ hogar: string; aviso: Aviso }[]> {
    const config = leerConfigHogar(h.config);
    const personas = (miembros?.data ?? [])
      .filter((m) => m.household_id === h.id && correos.has(m.user_id!))
      .map((m) => ({ email: correos.get(m.user_id!)!, nombre: m.nombre }));
    if (!personas.length) return [];
    resumen.hogares++;

    const datos: DatosHogar = {
      hogar: { id: h.id, nombre: h.nombre, resumenSemanal: config.correo.resumen_semanal },
      personas,
      recordatorios: (recordatorios?.data ?? []).filter((r) => r.household_id === h.id),
      vencidos: (vencidos?.data ?? [])
        .filter((t) => t.household_id === h.id && t.recurring_rules?.recordar !== false)
        .map((t) => ({ id: t.id, nombre: t.comercio ?? t.categories?.nombre ?? "Pago fijo", monto: t.monto, fecha: t.fecha, cuenta: t.accounts?.nombre ?? null })),
    };
    const resumenSemanal =
      lunes && config.correo.resumen_semanal
        ? Promise.all([
            db.from("transactions").select("tipo, monto, fecha, categories(nombre)").eq("household_id", h.id).eq("estado", "confirmado").in("tipo", ["ingreso", "gasto"]).gte("fecha", sumarDias(hoy, -14)).lt("fecha", hoy),
            db.from("transactions").select("comercio, monto, fecha, categories(nombre)").eq("household_id", h.id).eq("estado", "programado").eq("tipo", "gasto").gte("fecha", hoy).lte("fecha", sumarDias(hoy, 6)),
          ])
        : null;
    // El semáforo usa las mismas funciones que la pantalla Renta DIAN.
    const [semana, semaforo] = await Promise.all([
      resumenSemanal,
      cargarSemaforo({ supabase: db, hogar: { id: h.id, pais: h.pais } } as unknown as Parameters<typeof cargarSemaforo>[0], anio),
    ]);
    if (semana) {
      const [movs, proximos] = semana;
      datos.semana = {
        movimientos: (movs.data ?? []).map((m) => ({ tipo: m.tipo as "ingreso" | "gasto", monto: m.monto, fecha: m.fecha, categoria: m.categories?.nombre ?? null })),
        proximos: (proximos.data ?? []).map((p) => ({ nombre: p.comercio ?? p.categories?.nombre ?? "Pago", monto: p.monto, fecha: p.fecha })),
      };
    }
    if (semaforo.ok) datos.dian = { anio, personas: semaforo.personas };
    return planificarAvisos(datos, hoy, sitio()).map((aviso) => ({ hogar: h.id, aviso }));
  }

  // 1. Preparar por tandas, mientras haya tiempo.
  const planeados: { hogar: string; aviso: Aviso }[] = [];
  let ultimoPreparado: string | null = desde;
  for (let i = 0; i < hogares.length; i += HOGARES_EN_PARALELO) {
    if (Date.now() - inicio > LIMITE_PREPARAR_MS) break;
    const tanda = hogares.slice(i, i + HOGARES_EN_PARALELO);
    for (const lista of await Promise.all(tanda.map(preparar))) planeados.push(...lista);
    ultimoPreparado = tanda[tanda.length - 1].id;
  }
  const quedanHogares = hayMas || ultimoPreparado !== (ids[ids.length - 1] ?? desde);

  // 2. Reservar todas las claves en una consulta: solo vuelven las nuevas. Si dos ejecuciones coinciden, solo una envía.
  let porEnviar: typeof planeados = [];
  if (planeados.length) {
    const { data: reservadas, error } = await db
      .from("avisos_enviados")
      .upsert(planeados.map((p) => ({ household_id: p.hogar, clave: p.aviso.clave, tipo: p.aviso.tipo })), { onConflict: "household_id,clave", ignoreDuplicates: true })
      .select("household_id, clave");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const nuevas = new Set(reservadas.map((r) => `${r.household_id}|${r.clave}`));
    porEnviar = planeados.filter((p) => nuevas.has(`${p.hogar}|${p.aviso.clave}`));
    resumen.repetidos = planeados.length - porEnviar.length;
  }

  // 3. Enviar respetando el límite del proveedor. Lo que no alcance a salir se libera para la siguiente vuelta.
  const correosDe = porEnviar.flatMap((p, indice) => p.aviso.envios.map((envio) => ({ indice, envio })));
  const enviadosPorAviso = new Array<number>(porEnviar.length).fill(0);
  let cortado = false;
  for (let i = 0; i < correosDe.length; i += CORREOS_POR_SEGUNDO) {
    if (Date.now() - inicio > LIMITE_ENVIAR_MS) {
      cortado = true;
      break;
    }
    const tanda = correosDe.slice(i, i + CORREOS_POR_SEGUNDO);
    const [resultados] = await Promise.all([
      Promise.all(
        tanda.map(({ indice, envio }) =>
          enviarCorreo({ ...envio, etiqueta: porEnviar[indice].aviso.tipo, cabeceras: { "List-Unsubscribe": `<${sitio()}/recordatorios>` } }),
        ),
      ),
      i + CORREOS_POR_SEGUNDO < correosDe.length ? esperar(1000) : null,
    ]);
    resultados.forEach((r, k) => {
      if (r.enviado) enviadosPorAviso[tanda[k].indice]++;
      else resumen.fallidos++;
    });
  }
  // 4. Cerrar las reservas: con destinatarios se anota cuántos; sin ninguno (proveedor caído o sin tiempo) se libera.
  //    Un aviso cortado a la mitad (unos destinatarios sí, otros no) queda como enviado: no se repite a quien ya lo recibió.
  const liberar = porEnviar.filter((_, i) => enviadosPorAviso[i] === 0);
  const anotar = porEnviar.map((p, i) => ({ p, ok: enviadosPorAviso[i] })).filter(({ ok }) => ok > 0);
  resumen.avisos = anotar.length;
  resumen.correos = enviadosPorAviso.reduce((s, n) => s + n, 0);
  resumen.liberados = liberar.length;
  const liberarPorHogar = new Map<string, string[]>();
  for (const p of liberar) liberarPorHogar.set(p.hogar, [...(liberarPorHogar.get(p.hogar) ?? []), p.aviso.clave]);
  await Promise.all([
    ...[...liberarPorHogar].map(([hogar, claves]) => db.from("avisos_enviados").delete().eq("household_id", hogar).in("clave", claves)),
    ...anotar.map(({ p, ok }) => db.from("avisos_enviados").update({ destinatarios: ok }).eq("household_id", p.hogar).eq("clave", p.aviso.clave)),
  ]);

  // 5. Seguir en otra invocación si quedan hogares o se cortó el envío (repite la página: lo enviado ya está reservado).
  const siguiente = cortado ? (desde ?? "") : quedanHogares ? ultimoPreparado : null;
  if (siguiente !== null && vuelta < MAX_VUELTAS) {
    const url = new URL(request.nextUrl.pathname, request.nextUrl.origin);
    if (siguiente) url.searchParams.set("desde", siguiente);
    url.searchParams.set("vuelta", String(vuelta + 1));
    if (simulado) url.searchParams.set("hoy", simulado);
    // Se despacha y no se espera la respuesta: la siguiente vuelta corre con su propio tiempo límite.
    after(() => Promise.race([fetch(url, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }).catch(() => null), esperar(5000)]));
  }
  console.info(`[avisos] ${JSON.stringify({ hoy, vuelta, desde, ...resumen, siguiente })}`);
  return NextResponse.json({ hoy, vuelta, ...resumen, siguiente });
}
