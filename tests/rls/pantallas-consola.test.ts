/**
 * Pantallas de la consola frente al diseño: usuarios bloqueados, verificación de contadores y pago de comisiones,
 * tickets abiertos por el equipo, analítica por periodo con inversión por canal, uso de catálogos, indicadores de
 * privacidad y detalle de etiquetas DIAN.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conDosPasos, entornoDePrueba } from "./utilidades";

const entorno = entornoDePrueba();
const sr = entorno.admin;
let jefe: SupabaseClient, contenido: SupabaseClient, contador: SupabaseClient, cliente: SupabaseClient;
let correoCliente: string, idCliente: string, firma: string;
const limpiar: (() => PromiseLike<unknown>)[] = [];

beforeAll(async () => {
  const j = await entorno.usuario("pant-jefe");
  const c = await entorno.usuario("pant-contenido");
  const k = await entorno.usuario("pant-contador");
  const u = await entorno.usuario("pant-cliente");
  [jefe, contenido, contador, cliente] = [j.db, c.db, k.db, u.db];
  correoCliente = u.email;
  const id = async (db: SupabaseClient) => (await db.auth.getUser()).data.user!.id;
  idCliente = await id(cliente);
  const ins = await sr.from("platform_staff").insert([
    { user_id: await id(jefe), nombre: "Jefe pantallas", rol: "superadmin" },
    { user_id: await id(contenido), nombre: "Contenido pantallas", rol: "contenido" },
  ]);
  if (ins.error) throw ins.error;
  await conDosPasos(jefe);
  await conDosPasos(contenido);
  firma = await entorno.hogar(contador, "Firma pantallas", "contador");
  await entorno.hogar(cliente, "Hogar cliente pantallas");
});

afterAll(async () => {
  for (const f of limpiar.reverse()) await f();
  await entorno.limpiar();
});

describe("Usuarios", () => {
  it("lista y cuenta los bloqueados; desbloquear borra los intentos y queda auditado", async () => {
    for (let i = 0; i < 6; i++) await sr.rpc("registrar_ingreso", { p_email: correoCliente, p_ok: false });
    const lista = await jefe.rpc("consola_usuarios", { p_filtro: "bloqueados", p_buscar: correoCliente });
    expect((lista.data ?? []).map((x: { user_id: string }) => x.user_id)).toContain(idCliente);
    const { data: estado } = await jefe.rpc("consola_usuarios_estado", { p_ids: [idCliente] });
    expect(estado?.[0]).toMatchObject({ bloqueado: true, hogares: 1 });
    expect((await contenido.rpc("consola_desbloquear", { p_user: idCliente })).error?.message).toMatch(/permiso/i);
    expect((await jefe.rpc("consola_desbloquear", { p_user: idCliente })).error).toBeNull();
    expect((await sr.rpc("ingreso_bloqueado", { p_email: correoCliente })).data).toBe(0);
  });
});

describe("Contadores", () => {
  it("la firma pide la verificación; el equipo pide datos y luego aprueba", async () => {
    expect((await cliente.rpc("solicitar_verificacion_contador", { p_firma: firma, p_ciudad: "X", p_tarjeta: "123", p_clientes: 1, p_nota: "" })).error).not.toBeNull();
    const { data: sol, error } = await contador.rpc("solicitar_verificacion_contador", { p_firma: firma, p_ciudad: "Pereira", p_tarjeta: "TP-1234", p_clientes: 6, p_nota: "" });
    expect(error).toBeNull();
    expect(((await jefe.rpc("consola_solicitudes_contador")).data as { id: string }[]).map((s) => s.id)).toContain(sol);
    expect((await jefe.rpc("consola_responder_solicitud_contador", { p_id: sol, p_accion: "pedir_datos", p_mensaje: "" })).error?.message).toMatch(/datos faltan/i);
    expect((await jefe.rpc("consola_responder_solicitud_contador", { p_id: sol, p_accion: "pedir_datos", p_mensaje: "Adjunta la tarjeta por ambas caras" })).error).toBeNull();
    const vista = await contador.from("solicitudes_contador").select("estado, respuesta").eq("id", sol).single();
    expect(vista.data).toEqual({ estado: "datos_pedidos", respuesta: "Adjunta la tarjeta por ambas caras" });
    // Reenvía (la misma solicitud vuelve a pendiente) y se aprueba: la firma queda verificada.
    const { data: otra } = await contador.rpc("solicitar_verificacion_contador", { p_firma: firma, p_ciudad: "Pereira", p_tarjeta: "TP-1234", p_clientes: 6, p_nota: "Listo" });
    expect(otra).toBe(sol);
    expect((await jefe.rpc("consola_responder_solicitud_contador", { p_id: sol, p_accion: "aprobar", p_mensaje: "" })).error).toBeNull();
    expect((await sr.from("households").select("contador_verificado").eq("id", firma).single()).data?.contador_verificado).toBe(true);
    expect((await cliente.from("solicitudes_contador").select("id")).data).toEqual([]);
  });

  it("pagar comisiones marca todas las pendientes del mes", async () => {
    await sr.from("comisiones").insert({ firma, mes: "2026-10-01", pct: 20, hogares: 2, base: 100000, monto: 20000 });
    limpiar.push(() => sr.from("comisiones").delete().eq("firma", firma));
    expect((await contenido.rpc("consola_pagar_comisiones", { p_mes: "2026-10" })).error?.message).toMatch(/permiso/i);
    const { data } = await jefe.rpc("consola_pagar_comisiones", { p_mes: "2026-10" });
    expect(data).toMatchObject({ firmas: 1, total: 20000 });
    expect((await jefe.rpc("consola_pagar_comisiones", { p_mes: "2026-10" })).error?.message).toMatch(/no hay comisiones/i);
  });
});

describe("Soporte", () => {
  it("un ticket abierto por el equipo con el correo de una cuenta queda en su hogar y lo ve en Ayuda", async () => {
    const { data: id, error } = await contenido.rpc("consola_crear_ticket", {
      p_correo: correoCliente.toUpperCase(),
      p_nombre: "",
      p_asunto: "Llamó por un cobro",
      p_categoria: "cobros",
      p_prioridad: "alta",
      p_canal: "telefono",
      p_mensaje: "Dice que le cobraron dos veces.",
    });
    expect(error).toBeNull();
    const visto = await cliente.from("tickets").select("canal, prioridad, creado_nombre").eq("id", id).single();
    expect(visto.data).toMatchObject({ canal: "telefono", prioridad: "alta" });
    expect((await jefe.rpc("consola_soporte_tiempos")).error).toBeNull();
    expect((await cliente.rpc("consola_crear_ticket", { p_correo: "", p_nombre: "x", p_asunto: "Hola hola", p_categoria: "otro", p_prioridad: "normal", p_canal: "correo", p_mensaje: "mensaje largo" })).error).not.toBeNull();
  });
});

describe("Analítica, catálogos, privacidad y parámetros", () => {
  it("guarda inversión por canal y devuelve la analítica del periodo", async () => {
    expect((await jefe.rpc("consola_guardar_inversion", { p_mes: "2026-11", p_canal: "prueba-pantallas", p_monto: 500000 })).error).toBeNull();
    limpiar.push(() => sr.from("inversion_canal").delete().eq("canal", "prueba-pantallas"));
    const { data } = await jefe.rpc("consola_analitica_periodo", { p_dias: 7 });
    const a = data as { dias: number; inversion: { canal: string }[]; origenes: Record<string, number> };
    expect(a.dias).toBe(7);
    expect(a.inversion.some((i) => i.canal === "prueba-pantallas")).toBe(true);
    expect((await contenido.rpc("consola_guardar_inversion", { p_mes: "2026-11", p_canal: "x", p_monto: 1 })).error?.message).toMatch(/permiso/i);
  });

  it("uso de catálogos, indicadores de privacidad y detalle de etiquetas", async () => {
    const uso = await jefe.rpc("consola_catalogos_uso", { p_pais: "CO" });
    expect(uso.error).toBeNull();
    expect(Object.keys((uso.data as { categorias: object }).categorias).length).toBeGreaterThan(0);
    const k = await jefe.rpc("consola_privacidad_kpis");
    expect(k.data).toHaveProperty("abiertas");
    expect((await contenido.rpc("consola_privacidad_kpis")).error?.message).toMatch(/permiso/i);
    const { data: tag } = await sr.from("tax_tags").select("codigo, grupo, limite").eq("pais", "CO").limit(1).single();
    limpiar.push(() => sr.from("tax_tags").update({ grupo: tag!.grupo, limite: tag!.limite }).eq("pais", "CO").eq("codigo", tag!.codigo));
    expect((await contenido.rpc("consola_etiqueta_detalle", { p_pais: "CO", p_codigo: tag!.codigo, p_grupo: "deduccion", p_limite: "[validar con contador]" })).error).toBeNull();
    const e = await jefe.rpc("consola_etiquetas_uso", { p_pais: "CO" });
    expect((e.data as { uso: Record<string, { grupo: string }> }).uso[tag!.codigo].grupo).toBe("deduccion");
  });
});
