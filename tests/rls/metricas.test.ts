/**
 * Métricas y campañas (roadmap SaaS S4): los eventos de producto se registran una vez por hogar y nadie los lee
 * por la API; las métricas son solo de la consola; las campañas respetan el permiso de novedades (opt-in).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conDosPasos, entornoDePrueba } from "./utilidades";

const entorno = entornoDePrueba();
const sr = entorno.admin;
let admin: SupabaseClient, pareja: SupabaseClient, contenido: SupabaseClient, soporte: SupabaseClient;
let hogar: string;

const eventos = async (h: string) => (await sr.from("eventos").select("tipo").eq("household_id", h)).data!.map((e) => e.tipo).sort();

beforeAll(async () => {
  const a = await entorno.usuario("met-admin");
  const p = await entorno.usuario("met-pareja");
  const c = await entorno.usuario("met-contenido");
  const s = await entorno.usuario("met-soporte");
  admin = a.db; pareja = p.db; contenido = c.db; soporte = s.db;
  hogar = await entorno.hogar(admin, "Hogar métricas", "gratis");

  const inv = await admin.from("invitations").insert({ household_id: hogar, email: p.email, rol: "editor" }).select("token").single();
  await pareja.rpc("aceptar_invitacion", { p_token: inv.data!.token, p_nombre: "Pareja" });

  const ids = await Promise.all([contenido, soporte].map(async (db) => (await db.auth.getUser()).data.user!.id));
  await sr.from("platform_staff").insert([
    { user_id: ids[0], nombre: "Contenido métricas", rol: "contenido" },
    { user_id: ids[1], nombre: "Soporte métricas", rol: "soporte" },
  ]);
  await Promise.all([contenido, soporte].map(conDosPasos));
});

afterAll(() => entorno.limpiar());

describe("eventos de producto", () => {
  it("registro, pareja, pagos fijos y primer gasto se registran una sola vez", async () => {
    expect(await eventos(hogar)).toEqual(["invito_pareja", "registro"]);

    const cuenta = await admin.from("accounts").insert({ household_id: hogar, tipo: "banco", nombre: "Banco" }).select("id").single();
    const cat = (await admin.from("categories").select("id").eq("household_id", hogar).eq("nombre", "Mercado").single()).data!.id;
    const regla = { household_id: hogar, account_id: cuenta.data!.id, category_id: cat, descripcion: "Arriendo", monto: 100, tipo: "gasto", frecuencia: "mensual", fecha_inicio: "2026-01-01", proxima_fecha: "2026-12-01" };
    expect((await admin.from("recurring_rules").insert([regla, { ...regla, descripcion: "Internet" }])).error).toBeNull();
    for (let i = 0; i < 2; i++) {
      await admin.from("transactions").insert({ household_id: hogar, account_id: cuenta.data!.id, fecha: "2026-11-01", monto: 50, tipo: "gasto" });
    }
    expect(await eventos(hogar)).toEqual(["invito_pareja", "pagos_fijos_cargados", "primer_gasto", "registro"]);
  });

  it("canal de llegada: se guarda saneado al crear el hogar", async () => {
    const { data } = await admin.rpc("crear_hogar", { p_nombre: "Hogar canal", p_nombre_miembro: "Ana", p_canal: "Meta-Ads " });
    entorno.recordarHogar(data as string);
    const { data: h } = await sr.from("households").select("canal").eq("id", data as string).single();
    expect(h!.canal).toBe("meta-ads");
    const raro = await admin.rpc("crear_hogar", { p_nombre: "Hogar canal 2", p_nombre_miembro: "Ana", p_canal: "x'; drop--" });
    entorno.recordarHogar(raro.data as string);
    expect((await sr.from("households").select("canal").eq("id", raro.data as string).single()).data!.canal).toBeNull();
  });

  it("nadie lee ni escribe eventos por la API", async () => {
    expect((await admin.from("eventos").select("id").limit(1)).data ?? []).toEqual([]);
    expect((await admin.from("eventos").insert({ household_id: hogar, tipo: "pago" })).error).not.toBeNull();
  });
});

describe("métricas de la consola", () => {
  it("solo el equipo las ve, y el embudo cuenta este hogar", async () => {
    expect((await admin.rpc("consola_metricas")).error?.message).toMatch(/No tienes acceso/);
    const m = await soporte.rpc("consola_metricas");
    expect(m.error).toBeNull();
    const d = m.data as { registrados: number; embudo: { pareja: number; primer_gasto: number }; meses: unknown[]; semanas: unknown[] };
    expect(d.registrados).toBeGreaterThan(0);
    expect(d.embudo.pareja).toBeGreaterThan(0);
    expect(d.meses).toHaveLength(12);
    expect(d.semanas).toHaveLength(6);
    const a = await soporte.rpc("consola_analitica");
    expect(a.error).toBeNull();
    expect(a.data).toHaveProperty("cohortes");
    expect((a.data as { canales: { canal: string }[] }).canales.map((c) => c.canal)).toContain("meta-ads");
  });
});

describe("campañas", () => {
  let id: string;

  it("las maneja Contenido (permiso campanas); Soporte no", async () => {
    const datos = {
      p_id: null, p_nombre: "Temporada de renta", p_segmento: "gratis", p_asunto: "Llega la renta",
      p_titulo: "Prepara tu renta", p_cuerpo: "Con My House llegas con todo listo.", p_boton_texto: "Ver planes",
      p_boton_url: "/ajustes/plan", p_programada: null,
    };
    expect((await soporte.rpc("consola_guardar_campana", datos)).error?.message).toMatch(/no tiene permiso/);
    const r = await contenido.rpc("consola_guardar_campana", datos);
    expect(r.error).toBeNull();
    id = r.data as string;
    expect((await contenido.rpc("consola_campanas")).data!.some((c: { id: string }) => c.id === id)).toBe(true);
    const pasada = await contenido.rpc("consola_guardar_campana", { ...datos, p_id: id, p_programada: "2020-01-01T00:00:00Z" });
    expect(pasada.error?.message).toMatch(/ya pasó/);
    expect((await contenido.rpc("consola_guardar_campana", { ...datos, p_id: id, p_programada: new Date(Date.now() + 3600_000).toISOString() })).error).toBeNull();
  });

  it("los destinatarios exigen el permiso de novedades (opt-in) y la función es solo del servidor", async () => {
    expect((await contenido.rpc("campana_hogares", { p_campana: id })).error).not.toBeNull();
    const sin = await sr.rpc("campana_hogares", { p_campana: id });
    expect(sin.data).not.toContain(hogar); // gratis, pero sin aceptar novedades

    const { data: h } = await sr.from("households").select("config").eq("id", hogar).single();
    await sr.from("households").update({ config: { ...(h!.config as object), correo: { novedades: true } } }).eq("id", hogar);
    const con = await sr.rpc("campana_hogares", { p_campana: id });
    expect(con.data).toContain(hogar);

    const seg = await contenido.rpc("consola_segmentos");
    expect((seg.data as Record<string, { con_permiso: number }>).gratis.con_permiso).toBeGreaterThan(0);
  });

  it("cancelar y no editar una enviada", async () => {
    expect((await contenido.rpc("consola_cancelar_campana", { p_id: id })).error).toBeNull();
    await sr.from("campanas").update({ estado: "enviada" }).eq("id", id);
    const r = await contenido.rpc("consola_guardar_campana", {
      p_id: id, p_nombre: "X", p_segmento: "todos", p_asunto: "X", p_titulo: "X", p_cuerpo: "X",
      p_boton_texto: null, p_boton_url: null, p_programada: null,
    });
    expect(r.error?.message).toMatch(/no se puede editar/);
  });

  it("correos_enviados no se lee por la API; el resumen sí (consola)", async () => {
    expect((await admin.from("correos_enviados").select("id").limit(1)).data ?? []).toEqual([]);
    expect((await soporte.rpc("consola_correos_resumen")).error).toBeNull();
  });
});
