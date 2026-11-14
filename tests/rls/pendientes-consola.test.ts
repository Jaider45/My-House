/**
 * Pendientes de la consola: roles propios del equipo, celular y WhatsApp (consentimiento, registro y estados),
 * canal de campañas, textos de correos automáticos, políticas de sesión y métricas por periodo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conDosPasos, entornoDePrueba } from "./utilidades";

const entorno = entornoDePrueba();
const sr = entorno.admin;
let jefe: SupabaseClient, analista: SupabaseClient, cliente: SupabaseClient;
let idAnalista: string, idCliente: string;
const limpiar: (() => PromiseLike<unknown>)[] = [];

beforeAll(async () => {
  const j = await entorno.usuario("pend-jefe");
  const a = await entorno.usuario("pend-analista");
  const c = await entorno.usuario("pend-cliente");
  [jefe, analista, cliente] = [j.db, a.db, c.db];
  const id = async (db: SupabaseClient) => (await db.auth.getUser()).data.user!.id;
  idAnalista = await id(analista);
  idCliente = await id(cliente);
  const ins = await sr.from("platform_staff").insert([
    { user_id: await id(jefe), nombre: "Jefe pendientes", rol: "superadmin" },
    { user_id: idAnalista, nombre: "Analista pendientes", rol: "soporte" },
  ]);
  if (ins.error) throw ins.error;
  await conDosPasos(jefe);
  await conDosPasos(analista);
  await entorno.hogar(cliente, "Hogar pendientes");
});

afterAll(async () => {
  for (const f of limpiar) await f();
  await entorno.limpiar();
});

describe("roles propios", () => {
  it("un rol propio da exactamente sus permisos y no se borra mientras alguien lo tenga", async () => {
    const nombre = `Analista ${Math.random().toString(36).slice(2, 6)}`;
    const { data: rol, error } = await jefe.rpc("consola_guardar_rol", { p: { nombre, permisos: ["ver_hogares", "exportar"] } });
    expect(error).toBeNull();
    limpiar.push(() => sr.from("roles_staff").delete().eq("id", rol));
    limpiar.push(() => sr.from("platform_staff").update({ rol_personal: null }).eq("user_id", idAnalista));

    // Soporte puede ver tickets; al pasar al rol propio deja de poder y gana exportar.
    expect((await analista.rpc("consola_tickets", { p_estado: "abiertos", p_asignado: "todos" })).error).toBeNull();
    expect((await jefe.rpc("consola_cambiar_rol", { p_user: idAnalista, p_rol: "soporte", p_rol_personal: rol })).error).toBeNull();
    expect((await analista.rpc("consola_tickets", { p_estado: "abiertos", p_asignado: "todos" })).error?.message).toMatch(/permiso/i);
    const mios = await analista.rpc("mis_permisos_staff");
    expect(mios.data).toMatchObject({ permisos: ["ver_hogares", "exportar"], rol_nombre: nombre });

    const borrar = await jefe.rpc("consola_guardar_rol", { p: { id: rol, borrar: true } });
    expect(borrar.error?.message).toMatch(/personas con este rol/i);
    // Solo quien gestiona el equipo crea roles; un nombre de rol fijo no se puede usar.
    expect((await analista.rpc("consola_guardar_rol", { p: { nombre: "Otro", permisos: ["ver_hogares"] } })).error?.message).toMatch(/permiso/i);
    expect((await jefe.rpc("consola_guardar_rol", { p: { nombre: "Soporte", permisos: ["ver_hogares"] } })).error?.message).toMatch(/rol fijo/i);
  });

  it("un cliente no ve roles ni permisos del equipo", async () => {
    expect((await cliente.rpc("consola_roles")).error).not.toBeNull();
    expect((await cliente.rpc("mis_permisos_staff")).data).toBeNull();
    expect((await cliente.from("roles_staff").select("id")).error).not.toBeNull();
  });
});

describe("celular y WhatsApp", () => {
  it("cada quien guarda su celular (normaliza el indicativo) y solo lee el suyo", async () => {
    expect((await cliente.rpc("guardar_contacto", { p_telefono: "300 123 4567", p_whatsapp: true })).error).toBeNull();
    const { data } = await cliente.from("contactos").select("telefono, whatsapp, whatsapp_desde").single();
    expect(data).toMatchObject({ telefono: "+573001234567", whatsapp: true });
    expect(data?.whatsapp_desde).not.toBeNull();
    expect((await jefe.from("contactos").select("user_id")).data).toEqual([]);
    expect((await cliente.rpc("guardar_contacto", { p_telefono: "", p_whatsapp: true })).error?.message).toMatch(/celular/i);
    expect((await cliente.from("contactos").update({ whatsapp: false }).eq("user_id", idCliente).select()).data ?? []).toEqual([]);
  });

  it("el servidor lee los celulares autorizados; las personas no", async () => {
    expect((await cliente.rpc("telefonos_whatsapp", { p_ids: [idCliente] })).error).not.toBeNull();
    const { data } = await sr.rpc("telefonos_whatsapp", { p_ids: [idCliente] });
    expect(data).toEqual([{ user_id: idCliente, telefono: "+573001234567" }]);
  });

  it("el estado de un mensaje solo avanza (fallido siempre se registra)", async () => {
    const wamid = `wamid.prueba.${Math.random().toString(36).slice(2)}`;
    await sr.from("mensajes_whatsapp").insert({ wamid, tipo: "prueba", plantilla: "x", para: "+57•••67" });
    limpiar.push(() => sr.from("mensajes_whatsapp").delete().eq("wamid", wamid));
    const estado = async () => (await sr.from("mensajes_whatsapp").select("estado").eq("wamid", wamid).single()).data?.estado;
    await sr.rpc("mensaje_whatsapp_estado", { p_wamid: wamid, p_estado: "leido" });
    await sr.rpc("mensaje_whatsapp_estado", { p_wamid: wamid, p_estado: "entregado" });
    expect(await estado()).toBe("leido");
    await sr.rpc("mensaje_whatsapp_estado", { p_wamid: wamid, p_estado: "fallido", p_error: "131026" });
    expect(await estado()).toBe("fallido");
    expect((await cliente.from("mensajes_whatsapp").select("id")).error).not.toBeNull();
    const consola = await jefe.rpc("consola_mensajes_whatsapp");
    expect((consola.data as { autorizados: number }).autorizados).toBeGreaterThanOrEqual(1);
  });

  it("una campaña por WhatsApp exige una plantilla aprobada con todas sus variables", async () => {
    const { data: c } = await sr.from("campanas").insert({ nombre: "WA prueba", segmento: "todos", asunto: "", titulo: "", cuerpo: "" }).select("id").single();
    limpiar.push(() => sr.from("campanas").delete().eq("id", c!.id));
    const { data: p } = await sr
      .from("plantillas_whatsapp")
      .insert({ nombre: `prueba_${Math.random().toString(36).slice(2, 8)}`, cuerpo: "Hola {{1}}, tu hogar {{2}}", estado: "borrador" })
      .select("id")
      .single();
    limpiar.push(() => sr.from("plantillas_whatsapp").delete().eq("id", p!.id));
    const canal = (vars: string[]) => jefe.rpc("consola_campana_canal", { p_id: c!.id, p_canal: "whatsapp", p_plantilla: p!.id, p_vars: vars });
    expect((await canal(["nombre", "hogar"])).error?.message).toMatch(/aprobada/i);
    await sr.from("plantillas_whatsapp").update({ estado: "aprobada" }).eq("id", p!.id);
    expect((await canal(["nombre"])).error?.message).toMatch(/cada variable/i);
    expect((await canal(["nombre", "hogar"])).error).toBeNull();
    expect((await sr.from("campanas").select("canal, whatsapp_vars").eq("id", c!.id).single()).data).toEqual({ canal: "whatsapp", whatsapp_vars: ["nombre", "hogar"] });
  });
});

describe("ajustes nuevos", () => {
  it("valida los textos de correos, la inactividad y los días de sesión", async () => {
    const { data: antes } = await sr.from("plataforma_config").select("clave, valor").in("clave", ["correos_textos", "consola_sesion", "limites_app"]);
    limpiar.push(async () => {
      for (const f of antes ?? []) await sr.from("plataforma_config").update({ valor: f.valor }).eq("clave", f.clave);
    });
    expect((await jefe.rpc("consola_guardar_ajuste", { p_clave: "correos_textos", p_valor: { vencido: { asunto: "{pago} venció" } } })).error).toBeNull();
    expect((await jefe.rpc("consola_guardar_ajuste", { p_clave: "correos_textos", p_valor: { vencido: { html: "<b>x</b>" } } })).error?.message).toMatch(/mal formados/i);
    expect((await jefe.rpc("consola_guardar_ajuste", { p_clave: "consola_sesion", p_valor: { minutos: 2 } })).error?.message).toMatch(/240 minutos/);
    expect((await jefe.rpc("consola_guardar_ajuste", { p_clave: "consola_sesion", p_valor: { minutos: 60 } })).error).toBeNull();
    expect((await jefe.rpc("consola_guardar_ajuste", { p_clave: "limites_app", p_valor: { sesion_dias: 120 } })).error?.message).toMatch(/90 días/);
    expect((await analista.rpc("consola_guardar_ajuste", { p_clave: "consola_sesion", p_valor: { minutos: 60 } })).error?.message).toMatch(/permiso/i);
  });

  it("las métricas por periodo traen la serie y 12 meses de MRR", async () => {
    const { data, error } = await jefe.rpc("consola_metricas_periodo", { p_dias: 7 });
    expect(error).toBeNull();
    const m = data as { dias: number; serie: unknown[]; mrr_historia: unknown[] };
    expect(m.dias).toBe(7);
    expect(m.serie).toHaveLength(7);
    expect(m.mrr_historia).toHaveLength(12);
    expect(((await jefe.rpc("consola_metricas_periodo", { p_dias: 365 })).data as { serie: unknown[] }).serie).toHaveLength(12);
  });
});
