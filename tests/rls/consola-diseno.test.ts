/**
 * Diseño «Admin SaaS» con lógica en la base: permiso contenido_app, Legal (versiones, revisión del abogado por enlace,
 * aceptación), Ofertas (audiencia, cerrar, clics), Academia (vistas, recomendaciones, talleres con cupos), plantillas
 * de WhatsApp, segmentos propios y avisos transaccionales, ajustes de la plataforma, bloqueo de ingreso y crear hogar.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conDosPasos, entornoDePrueba } from "./utilidades";

const entorno = entornoDePrueba();
const sr = entorno.admin;
let jefe: SupabaseClient, soporte: SupabaseClient, gratisDb: SupabaseClient, familiaDb: SupabaseClient, otroDb: SupabaseClient;
let hogarGratis: string, hogarFamilia: string;
const limpiar: (() => PromiseLike<unknown>)[] = [];

beforeAll(async () => {
  const j = await entorno.usuario("diseno-jefe");
  const s = await entorno.usuario("diseno-soporte");
  const g = await entorno.usuario("diseno-gratis");
  const f = await entorno.usuario("diseno-familia");
  const o = await entorno.usuario("diseno-otro");
  [jefe, soporte, gratisDb, familiaDb, otroDb] = [j.db, s.db, g.db, f.db, o.db];
  const id = async (db: SupabaseClient) => (await db.auth.getUser()).data.user!.id;
  const ins = await sr.from("platform_staff").insert([
    { user_id: await id(jefe), nombre: "Jefe diseño", rol: "superadmin" },
    { user_id: await id(soporte), nombre: "Soporte diseño", rol: "soporte" },
  ]);
  if (ins.error) throw ins.error;
  await conDosPasos(jefe);
  await conDosPasos(soporte);
  hogarGratis = await entorno.hogar(gratisDb, "Hogar gratis diseño", "gratis");
  hogarFamilia = await entorno.hogar(familiaDb, "Hogar familia diseño");
  await otroDb.rpc("crear_hogar", { p_nombre: "Hogar otro diseño", p_nombre_miembro: "Otro" }).then((r) => entorno.recordarHogar(r.data as string));
});

afterAll(async () => {
  for (const f of limpiar) await f();
  await entorno.limpiar();
});

describe("permisos", () => {
  it("Soporte no edita contenido de la app; un cliente no entra a la consola", async () => {
    const r = await soporte.rpc("consola_guardar_oferta", { p: { titulo: "No", lugar: "inicio" } });
    expect(r.error?.message).toMatch(/permiso/i);
    const c = await gratisDb.rpc("consola_ofertas");
    expect(c.error).not.toBeNull();
  });
});

describe("Legal", () => {
  it("pide aceptar los documentos obligatorios y deja de pedirlos al aceptar", async () => {
    const antes = await gratisDb.rpc("mis_pendientes_legales");
    expect((antes.data as { clave: string }[]).map((d) => d.clave).sort()).toEqual(["politica_datos", "terminos"]);
    expect((await gratisDb.rpc("aceptar_vigentes", {})).error).toBeNull();
    expect(await gratisDb.rpc("mis_pendientes_legales").then((r) => r.data)).toEqual([]);
  });

  it("versión nueva → abogado por enlace (sin cuenta) → publicar; los borradores no se ven", async () => {
    const clave = `prueba_${Math.random().toString(36).slice(2, 7)}`;
    limpiar.push(() => sr.from("documentos_legales").delete().eq("clave", clave));
    expect((await jefe.rpc("consola_nuevo_documento", { p_clave: clave, p_nombre: "Documento de prueba" })).error).toBeNull();
    const { data: v } = await sr.from("documento_versiones").select("id").eq("documento", clave).single();
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
    expect((await jefe.rpc("consola_guardar_version", { p_id: v!.id, p_contenido: "## Uno\n\nTexto de la versión uno de prueba.", p_resumen: "Primera", p_vigente: hoy, p_pedir: false, p_avisar: false })).error).toBeNull();
    // El borrador no es público.
    expect((await gratisDb.from("documento_versiones").select("id").eq("documento", clave)).data).toEqual([]);
    // No se publica sin aprobación.
    expect((await jefe.rpc("consola_publicar_version", { p_id: v!.id })).error?.message).toMatch(/abogado/);
    const token = `tok-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}-xxxxxxxx`;
    expect((await jefe.rpc("consola_pedir_revision", { p_id: v!.id, p_correo: "abogado@firma.co", p_token: token })).error).toBeNull();
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    expect((await anon.rpc("revision_legal_ver", { p_token: "otro" })).data).toBeNull();
    const ver = await anon.rpc("revision_legal_ver", { p_token: token });
    expect((ver.data as { version: string }).version).toBe("1.0");
    expect((await anon.rpc("revision_legal_responder", { p_token: token, p_aprobada: true, p_nombre: "Abogada Prueba", p_nota: "" })).error).toBeNull();
    // El token ya no sirve para responder otra vez.
    expect((await anon.rpc("revision_legal_responder", { p_token: token, p_aprobada: true, p_nombre: "Abogada Prueba", p_nota: "" })).error).not.toBeNull();
    expect((await jefe.rpc("consola_publicar_version", { p_id: v!.id })).error).toBeNull();
    expect((await gratisDb.from("documento_versiones").select("version").eq("documento", clave)).data).toEqual([{ version: "1.0" }]);
    // El token y el correo del abogado nunca son legibles por la API.
    expect((await gratisDb.from("documento_revisiones").select("token_hash")).error).not.toBeNull();
  });
});

describe("Ofertas y enlaces", () => {
  it("cada hogar ve la oferta de su audiencia, puede cerrarla y el clic cuenta", async () => {
    const { data: id, error } = await jefe.rpc("consola_guardar_oferta", {
      p: { titulo: "Prueba Gratis", texto: "Solo para Gratis", lugar: "metas", audiencia: "gratis", boton_texto: "Ver", boton_url: "/ajustes/plan", publicada: true },
    });
    expect(error).toBeNull();
    limpiar.push(() => sr.from("ofertas").delete().eq("id", id as string));
    const g = await gratisDb.rpc("mi_oferta", { p_lugar: "metas" });
    expect((g.data as { id: string }).id).toBe(id);
    expect((await familiaDb.rpc("mi_oferta", { p_lugar: "metas" })).data).toBeNull();
    expect((await gratisDb.rpc("clic_oferta", { p_id: id as string })).data).toBe("/ajustes/plan");
    expect((await familiaDb.rpc("clic_oferta", { p_id: id as string })).data).toBeNull();
    await gratisDb.rpc("cerrar_oferta", { p_id: id as string });
    expect((await gratisDb.rpc("mi_oferta", { p_lugar: "metas" })).data).toBeNull();
    const fila = (await sr.from("ofertas").select("vistas, clics").eq("id", id as string).single()).data!;
    expect(fila).toEqual({ vistas: 1, clics: 1 });
    expect((await gratisDb.from("ofertas").select("id")).error).not.toBeNull();
  });
});

describe("Academia", () => {
  it("lo publicado se lee; la recomendación desaparece cuando la persona ya vio la lección", async () => {
    const { data: rutas } = await gratisDb.from("academia_rutas").select("slug");
    expect(rutas!.length).toBeGreaterThanOrEqual(6);
    const recs = async () => ((await gratisDb.rpc("mis_recomendaciones", { p_lugar: "academia" })).data as { condicion: string; leccion: string }[]).map((r) => r.leccion);
    expect(await recs()).toContain("numero-minimo");
    await gratisDb.rpc("academia_vista", { p_clave: "finanzas/numero-minimo" });
    expect(await recs()).not.toContain("numero-minimo");
    expect((await gratisDb.rpc("academia_calificar", { p_clave: "finanzas/numero-minimo", p_estrellas: 5 })).error).toBeNull();
    expect((await gratisDb.from("academia_vistas").select("clave")).error).not.toBeNull();
  });

  it("un taller respeta los cupos y solo muestra el enlace a quien se inscribió", async () => {
    const fecha = new Date(Date.now() + 7 * 864e5).toISOString();
    expect((await jefe.rpc("consola_guardar_taller", { p: { titulo: "Taller de prueba", fecha, enlace: "https://zoom.us/j/1", cupos: 1, publicado: true } })).error).toBeNull();
    const { data: t } = await sr.from("academia_talleres").select("id").eq("titulo", "Taller de prueba").single();
    limpiar.push(() => sr.from("academia_talleres").delete().eq("id", t!.id));
    const antes = (await familiaDb.rpc("talleres_academia")).data as { id: string; enlace: string | null }[];
    expect(antes.find((x) => x.id === t!.id)?.enlace).toBeNull();
    expect((await familiaDb.rpc("inscribir_taller", { p_id: t!.id, p_inscribir: true })).error).toBeNull();
    const despues = (await familiaDb.rpc("talleres_academia")).data as { id: string; enlace: string | null }[];
    expect(despues.find((x) => x.id === t!.id)?.enlace).toBe("https://zoom.us/j/1");
    expect((await gratisDb.rpc("inscribir_taller", { p_id: t!.id, p_inscribir: true })).error?.message).toMatch(/cupos/);
  });
});

describe("Plantillas de WhatsApp", () => {
  it("se guardan en borrador, toman el estado de Meta y no se editan una vez enviadas", async () => {
    const nombre = `prueba_${Math.random().toString(36).slice(2, 7)}`;
    const { data: id, error } = await jefe.rpc("consola_guardar_plantilla", { p: { nombre, categoria: "UTILITY", cuerpo: "Hola {{1}}, tu pago vence pronto.", ejemplos: ["Ana"], botones: [] } });
    expect(error).toBeNull();
    limpiar.push(() => sr.from("plantillas_whatsapp").delete().eq("id", id as string));
    expect((await jefe.rpc("consola_plantilla_enviada", { p_id: id as string, p_meta_id: "123", p_estado: "en_revision" })).error).toBeNull();
    expect((await jefe.rpc("consola_guardar_plantilla", { p: { id, nombre, categoria: "UTILITY", cuerpo: "Otro" } })).error?.message).toMatch(/duplícala/);
    const rechazada = await sr.rpc("plantilla_estado_meta", { p_nombre: nombre, p_idioma: "es", p_estado: "rechazada", p_motivo: "Formato", p_meta_id: "123" });
    expect(rechazada.data).toBe(true);
    expect((await gratisDb.rpc("plantilla_estado_meta", { p_nombre: nombre, p_idioma: "es", p_estado: "aprobada", p_motivo: "", p_meta_id: "1" })).error).not.toBeNull();
  });
});

describe("Segmentos y campañas", () => {
  it("un segmento propio filtra por plan; las novedades piden permiso y los avisos transaccionales no", async () => {
    expect((await jefe.rpc("consola_guardar_segmento", { p: { nombre: "Familia de prueba", plan: "familia", condiciones: [], actividad: "cualquiera" } })).error).toBeNull();
    const { data: seg } = await sr.from("segmentos").select("id").eq("nombre", "Familia de prueba").single();
    limpiar.push(() => sr.from("segmentos").delete().eq("id", seg!.id));
    const { data: cid, error } = await jefe.rpc("consola_guardar_campana_editor", {
      p: { nombre: "Campaña de prueba", segmento: "propio", segmento_propio: seg!.id, asunto: "Hola", bloques: [{ tipo: "texto", texto: "Hola {nombre}" }] },
    });
    expect(error).toBeNull();
    limpiar.push(() => sr.from("campanas").delete().eq("id", cid as string));
    const hogares = async () => ((await sr.rpc("campana_hogares", { p_campana: cid as string })).data ?? []) as string[];
    expect(await hogares()).not.toContain(hogarFamilia);
    await sr.from("households").update({ config: { correo: { novedades: true } } }).eq("id", hogarFamilia);
    expect(await hogares()).toContain(hogarFamilia);
    expect(await hogares()).not.toContain(hogarGratis);
    await sr.from("campanas").update({ transaccional: true, segmento: "todos" }).eq("id", cid as string);
    expect(await hogares()).toEqual(expect.arrayContaining([hogarGratis, hogarFamilia]));
  });
});

describe("Ajustes de la plataforma", () => {
  it("valida la forma: el paso a Gratis va después del último reintento", async () => {
    expect((await jefe.rpc("consola_guardar_ajuste", { p_clave: "cobro_dia_gratis", p_valor: 5 })).error?.message).toMatch(/entre el día 7/);
    expect((await jefe.rpc("consola_guardar_ajuste", { p_clave: "empresa", p_valor: { campo_raro: "x" } })).error?.message).toMatch(/Campo desconocido/);
    expect((await soporte.rpc("consola_guardar_ajuste", { p_clave: "empresa", p_valor: { nit: "1" } })).error).not.toBeNull();
  });

  it("el ingreso se bloquea tras los intentos fallidos configurados y se libera al entrar bien", async () => {
    const correo = `bloqueo-${Math.random().toString(36).slice(2, 7)}@prueba.local`;
    for (let i = 0; i < 5; i++) await sr.rpc("registrar_ingreso", { p_email: correo, p_ok: false });
    expect(((await sr.rpc("ingreso_bloqueado", { p_email: correo })).data as number) > 0).toBe(true);
    await sr.rpc("registrar_ingreso", { p_email: correo, p_ok: true });
    expect((await sr.rpc("ingreso_bloqueado", { p_email: correo })).data).toBe(0);
    expect((await gratisDb.rpc("ingreso_bloqueado", { p_email: correo })).error).not.toBeNull();
  });
});

describe("Crear hogar desde la consola", () => {
  it("nace con una invitación de administrador que se puede reenviar", async () => {
    const r = await soporte.rpc("consola_crear_hogar", { p_nombre: "Hogar creado por soporte", p_correo: "nuevo-admin@prueba.local" });
    expect(r.error).toBeNull();
    const d = r.data as { hogar: string; token: string };
    entorno.recordarHogar(d.hogar);
    const inv = await sr.from("invitations").select("rol, email").eq("household_id", d.hogar).single();
    expect(inv.data).toEqual({ rol: "admin", email: "nuevo-admin@prueba.local" });
    const re = await soporte.rpc("consola_reenviar_invitacion", { p_hogar: d.hogar, p_correo: "nuevo-admin@prueba.local" });
    expect((re.data as { token: string }).token).toBe(d.token);
  });
});
