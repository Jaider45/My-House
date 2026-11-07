import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { planificarAvisos, type DatosHogar } from "@/lib/avisos";
import { enviarCorreo, sitio } from "@/lib/correo/enviar";
import { hoy as hoyBogota, sumarDias } from "@/lib/fechas";
import { leerConfigHogar } from "@/lib/hogar";
import { cargarSemaforo } from "@/lib/impuestos/servidor";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Avisos programados por correo. Lo llama Vercel Cron cada día a las 7:00 a. m. de Bogotá (vercel.json) con
 * `Authorization: Bearer $CRON_SECRET`. Recorre todos los hogares, así que usa la llave service_role (solo aquí, en
 * el servidor). Qué sale y a quién lo decide `planificarAvisos`; lo ya enviado queda en avisos_enviados.
 * `?hoy=AAAA-MM-DD` simula otra fecha (fuera de producción, o con AVISOS_SIMULAR_FECHA=1 para probar un build local).
 */
export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }
  const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const simulado = request.nextUrl.searchParams.get("hoy");
  const simular = process.env.NODE_ENV !== "production" || process.env.AVISOS_SIMULAR_FECHA === "1";
  const hoy = simulado && simular && /^\d{4}-\d{2}-\d{2}$/.test(simulado) ? simulado : hoyBogota();
  const anio = Number(hoy.slice(0, 4));
  const lunes = new Date(`${hoy}T00:00:00Z`).getUTCDay() === 1;
  const ayer = sumarDias(hoy, -1);

  // Correos de los usuarios (Auth) y adultos que escriben (admin/editor) de cada hogar.
  const correos = new Map<string, string>();
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await db.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const u of data.users) if (u.email) correos.set(u.id, u.email);
    if (data.users.length < 1000) break;
  }

  const [hogares, miembros, recordatorios, vencidos] = await Promise.all([
    db.from("households").select("id, nombre, pais, config"),
    db.from("members").select("household_id, nombre, user_id, rol").not("user_id", "is", null).in("rol", ["admin", "editor"]),
    db.from("reminders").select("id, household_id, nombre, fecha, monto, repetir, avisos, canales, activo").eq("activo", true).contains("canales", ["correo"]),
    db
      .from("transactions")
      .select("id, household_id, comercio, monto, fecha, accounts!transactions_account_id_household_id_fkey(nombre), categories(nombre), recurring_rules(recordar)")
      .eq("estado", "programado")
      .eq("tipo", "gasto")
      .eq("fecha", ayer),
  ]);
  const fallo = [hogares, miembros, recordatorios, vencidos].find((r) => r.error)?.error;
  if (fallo) return NextResponse.json({ error: fallo.message }, { status: 500 });

  const resumen: Record<string, number> = { hogares: 0, avisos: 0, correos: 0, fallidos: 0, repetidos: 0 };
  for (const h of hogares.data ?? []) {
    const config = leerConfigHogar(h.config);
    const personas = (miembros.data ?? [])
      .filter((m) => m.household_id === h.id && m.user_id && correos.has(m.user_id))
      .map((m) => ({ email: correos.get(m.user_id!)!, nombre: m.nombre }));
    if (!personas.length) continue;
    resumen.hogares++;

    const datos: DatosHogar = {
      hogar: { id: h.id, nombre: h.nombre, resumenSemanal: config.correo.resumen_semanal },
      personas,
      recordatorios: (recordatorios.data ?? []).filter((r) => r.household_id === h.id),
      vencidos: (vencidos.data ?? [])
        .filter((t) => t.household_id === h.id && t.recurring_rules?.recordar !== false)
        .map((t) => ({ id: t.id, nombre: t.comercio ?? t.categories?.nombre ?? "Pago fijo", monto: t.monto, fecha: t.fecha, cuenta: t.accounts?.nombre ?? null })),
    };
    if (lunes && config.correo.resumen_semanal) {
      const [movs, proximos] = await Promise.all([
        db.from("transactions").select("tipo, monto, fecha, categories(nombre)").eq("household_id", h.id).eq("estado", "confirmado").in("tipo", ["ingreso", "gasto"]).gte("fecha", sumarDias(hoy, -14)).lt("fecha", hoy),
        db.from("transactions").select("comercio, monto, fecha, categories(nombre)").eq("household_id", h.id).eq("estado", "programado").eq("tipo", "gasto").gte("fecha", hoy).lte("fecha", sumarDias(hoy, 6)),
      ]);
      datos.semana = {
        movimientos: (movs.data ?? []).map((m) => ({ tipo: m.tipo as "ingreso" | "gasto", monto: m.monto, fecha: m.fecha, categoria: m.categories?.nombre ?? null })),
        proximos: (proximos.data ?? []).map((p) => ({ nombre: p.comercio ?? p.categories?.nombre ?? "Pago", monto: p.monto, fecha: p.fecha })),
      };
    }
    // El semáforo usa las mismas funciones que la pantalla Renta DIAN.
    const semaforo = await cargarSemaforo({ supabase: db, hogar: { id: h.id, pais: h.pais } } as unknown as Parameters<typeof cargarSemaforo>[0], anio);
    if (semaforo.ok) datos.dian = { anio, personas: semaforo.personas };

    const avisos = planificarAvisos(datos, hoy, sitio());
    if (!avisos.length) continue;
    const { data: yaEnviados } = await db.from("avisos_enviados").select("clave").eq("household_id", h.id).in("clave", avisos.map((a) => a.clave));
    const enviados = new Set((yaEnviados ?? []).map((e) => e.clave));
    for (const aviso of avisos) {
      if (enviados.has(aviso.clave)) {
        resumen.repetidos++;
        continue;
      }
      // Se reserva la clave antes de enviar: si dos ejecuciones coinciden, solo una envía.
      const { error: reservado } = await db.from("avisos_enviados").insert({ household_id: h.id, clave: aviso.clave, tipo: aviso.tipo });
      if (reservado) {
        resumen.repetidos++;
        continue;
      }
      let ok = 0;
      for (const envio of aviso.envios) {
        const r = await enviarCorreo({
          ...envio,
          etiqueta: aviso.tipo,
          cabeceras: { "List-Unsubscribe": `<${sitio()}/recordatorios>` },
        });
        if (r.enviado) ok++;
        else resumen.fallidos++;
      }
      // Si no salió ninguno (proveedor caído), se libera la clave para reintentar mañana.
      if (!ok) await db.from("avisos_enviados").delete().eq("household_id", h.id).eq("clave", aviso.clave);
      else await db.from("avisos_enviados").update({ destinatarios: ok }).eq("household_id", h.id).eq("clave", aviso.clave);
      resumen.avisos++;
      resumen.correos += ok;
    }
  }
  return NextResponse.json({ hoy, ...resumen });
}
