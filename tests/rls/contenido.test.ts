/**
 * Contenido y parámetros (roadmap SaaS S6): la UVT, una regla de comercio o el umbral de la IA se cambian desde la
 * consola sin desplegar; solo Contenido o un superadmin; los borradores no llegan a los hogares hasta publicarlos.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conDosPasos, entornoDePrueba } from "./utilidades";

const entorno = entornoDePrueba();
const sr = entorno.admin;
let admin: SupabaseClient, pareja: SupabaseClient, contenido: SupabaseClient, soporte: SupabaseClient;
let hogar: string;
const ANIO = 2091; // un año que ninguna otra prueba usa

const config = async (clave: string) => (await sr.from("plataforma_config").select("valor").eq("clave", clave).single()).data!.valor;

beforeAll(async () => {
  const a = await entorno.usuario("cont-admin");
  const p = await entorno.usuario("cont-pareja");
  const c = await entorno.usuario("cont-contenido");
  const s = await entorno.usuario("cont-soporte");
  admin = a.db; pareja = p.db; contenido = c.db; soporte = s.db;
  hogar = await entorno.hogar(admin, "Hogar contenido");
  const inv = await admin.from("invitations").insert({ household_id: hogar, email: p.email, rol: "editor" }).select("token").single();
  await pareja.rpc("aceptar_invitacion", { p_token: inv.data!.token, p_nombre: "Pareja" });

  const ids = await Promise.all([contenido, soporte].map(async (db) => (await db.auth.getUser()).data.user!.id));
  await sr.from("platform_staff").insert([
    { user_id: ids[0], nombre: "Contenido S6", rol: "contenido" },
    { user_id: ids[1], nombre: "Soporte S6", rol: "soporte" },
  ]);
  await Promise.all([contenido, soporte].map(conDosPasos));
});

afterAll(async () => {
  await sr.from("tax_params").delete().eq("anio", ANIO);
  await sr.from("calendario_tributario").delete().eq("anio_gravable", ANIO);
  await sr.from("reglas_comercio_globales").delete().like("patron", "prueba s6%");
  await sr.from("categorias_base").delete().eq("nombre", "Categoría S6");
  // jsonb `null` («sin tope») no se puede escribir con supabase-js (lo manda como NULL de SQL): por la función.
  await contenido.rpc("consola_guardar_config_ia", { p_clave: "ia_tope_usd_mes", p_valor: null });
  await sr.from("plataforma_config").update({ valor: 70 }).eq("clave", "ia_umbral");
  await sr.from("plataforma_config").update({ valor: {} }).eq("clave", "ia_precios");
  await entorno.limpiar();
});

describe("parámetros DIAN", () => {
  const topes = { ingresos_brutos: 1400, patrimonio_bruto: 4500, consumos_tarjeta: 1400, compras_consumos: 1400, consignaciones: 1400 };

  it("Soporte no edita; Contenido guarda un borrador que los hogares no ven", async () => {
    const datos = { p_pais: "CO", p_anio: ANIO, p_uvt: 60000, p_topes: topes, p_deducciones: {}, p_fuente: "Prueba" };
    expect((await soporte.rpc("consola_guardar_parametros", datos)).error?.message).toMatch(/no tiene permiso/);
    expect((await contenido.rpc("consola_guardar_parametros", { ...datos, p_uvt: 5 })).error?.message).toMatch(/UVT/);
    expect((await contenido.rpc("consola_guardar_parametros", { ...datos, p_topes: { ingresos_brutos: -1 } })).error?.message).toMatch(/topes/);
    expect((await contenido.rpc("consola_guardar_parametros", datos)).error).toBeNull();
    expect((await admin.from("tax_params").select("anio").eq("anio", ANIO)).data).toEqual([]);
  });

  it("al publicar rige; un cambio posterior queda en borrador sin tocar lo publicado", async () => {
    expect((await contenido.rpc("consola_publicar_parametros", { p_pais: "CO", p_anio: ANIO })).error).toBeNull();
    expect((await admin.from("tax_params").select("uvt_valor").eq("anio", ANIO).single()).data!.uvt_valor).toBe(60000);

    await contenido.rpc("consola_guardar_parametros", { p_pais: "CO", p_anio: ANIO, p_uvt: 61000, p_topes: topes, p_deducciones: {}, p_fuente: "Prueba 2" });
    expect((await admin.from("tax_params").select("uvt_valor").eq("anio", ANIO).single()).data!.uvt_valor).toBe(60000);
    await contenido.rpc("consola_descartar_parametros", { p_pais: "CO", p_anio: ANIO });
    expect((await sr.from("tax_params").select("borrador").eq("anio", ANIO).single()).data!.borrador).toBeNull();

    const audit = await sr.from("auditoria").select("accion").eq("objeto_id", `CO:${ANIO}`);
    expect(audit.data!.map((a) => a.accion)).toEqual(expect.arrayContaining(["borrador_parametros", "publico_parametros", "descarto_parametros"]));
  });

  it("los hogares no escriben parámetros", async () => {
    expect((await admin.from("tax_params").update({ uvt_valor: 1 }).eq("anio", ANIO).select("id")).data ?? []).toEqual([]);
    expect((await admin.from("calendario_tributario").insert({ pais: "CO", anio_gravable: ANIO, digitos: 1, fecha: `${ANIO + 1}-08-01` })).error).not.toBeNull();
  });

  it("calendario: exige las 100 terminaciones con fechas del año siguiente", async () => {
    const fechas = Array.from({ length: 100 }, (_, d) => ({ d, fecha: `${ANIO + 1}-08-${String(1 + Math.floor(d / 4)).padStart(2, "0")}` }));
    expect((await contenido.rpc("consola_guardar_calendario", { p_pais: "CO", p_anio: ANIO, p_fechas: fechas.slice(1) })).error?.message).toMatch(/100 terminaciones/);
    expect((await contenido.rpc("consola_guardar_calendario", { p_pais: "CO", p_anio: ANIO, p_fechas: fechas })).error).toBeNull();
    const { data } = await admin.from("calendario_tributario").select("fecha").eq("anio_gravable", ANIO).eq("digitos", 7).single();
    expect(data!.fecha).toBe(`${ANIO + 1}-08-02`);
  });

  it("dígitos de la cédula: cada persona los suyos, el admin los de todos", async () => {
    const miembros = (await admin.from("members").select("id, nombre").eq("household_id", hogar)).data!;
    const delAdmin = miembros.find((m) => m.nombre === "Prueba")!.id;
    const deLaPareja = miembros.find((m) => m.nombre === "Pareja")!.id;
    expect((await pareja.rpc("guardar_digitos_cedula", { p_member: deLaPareja, p_digitos: "07" })).error).toBeNull();
    expect((await pareja.rpc("guardar_digitos_cedula", { p_member: delAdmin, p_digitos: "11" })).error?.message).toMatch(/No puedes/);
    expect((await admin.rpc("guardar_digitos_cedula", { p_member: delAdmin, p_digitos: "1" })).error?.message).toMatch(/dos últimos/);
    expect((await admin.rpc("guardar_digitos_cedula", { p_member: delAdmin, p_digitos: "11" })).error).toBeNull();
  });
});

describe("catálogos", () => {
  it("una categoría base nueva la recibe el hogar que se crea después; la tabla no se lee por la API", async () => {
    const r = await contenido.rpc("consola_guardar_categoria_base", {
      p_id: null, p_nombre: "Categoría S6", p_padre: null, p_clase: "gasto", p_tipo: "variable",
      p_esencial: false, p_excluir: false, p_etiqueta: null, p_orden: 99, p_activa: true,
    });
    expect(r.error).toBeNull();
    expect((await soporte.rpc("consola_guardar_categoria_base", { p_id: null, p_nombre: "X", p_padre: null, p_clase: "gasto", p_tipo: "variable", p_esencial: false, p_excluir: false, p_etiqueta: null, p_orden: 1, p_activa: true })).error?.message).toMatch(/no tiene permiso/);
    const nuevo = await entorno.hogar(admin, "Hogar nace con S6");
    const cats = (await admin.from("categories").select("nombre").eq("household_id", nuevo)).data!.map((c) => c.nombre);
    expect(cats).toContain("Categoría S6");
    expect(cats).toContain("Mercado");
    expect((await admin.from("categorias_base").select("id").limit(1)).data ?? []).toEqual([]);
  });

  it("reglas globales: las activas se leen, las inactivas no; el patrón se valida", async () => {
    expect((await contenido.rpc("consola_guardar_regla_global", { p_id: null, p_patron: "Prueba S6", p_categoria: "Mercado", p_ambito: null, p_activa: true, p_origen: "manual" })).error?.message).toMatch(/minúsculas/);
    const n = await contenido.rpc("consola_importar_reglas", { p_filas: [{ patron: "prueba s6 uno", categoria: "Mercado" }, { patron: "prueba s6 dos", categoria: "Salud" }] });
    expect(n.data).toBe(2);
    const id = (await sr.from("reglas_comercio_globales").select("id").eq("patron", "prueba s6 dos").single()).data!.id;
    await contenido.rpc("consola_guardar_regla_global", { p_id: id, p_patron: "prueba s6 dos", p_categoria: "Salud", p_ambito: null, p_activa: false, p_origen: "manual" });
    const visibles = (await admin.from("reglas_comercio_globales").select("patron").like("patron", "prueba s6%")).data!.map((r) => r.patron);
    expect(visibles).toEqual(["prueba s6 uno"]);
    expect((await admin.from("reglas_comercio_globales").insert({ patron: "hackeo", categoria: "Mercado" })).error).not.toBeNull();
  });

  it("formatos: el mapeo debe usar los encabezados", async () => {
    const mal = await contenido.rpc("consola_guardar_formato", { p_id: null, p_banco: "Banco S6", p_encabezados: ["Fecha", "Valor"], p_mapeo: { fecha: "Fecha", descripcion: "Otra", modo: "unico", monto: "Valor" }, p_activo: true });
    expect(mal.error?.message).toMatch(/encabezados/);
    const bien = await contenido.rpc("consola_guardar_formato", { p_id: null, p_banco: "Banco S6", p_encabezados: ["Fecha", "Detalle", "Valor"], p_mapeo: { fecha: "Fecha", descripcion: "Detalle", modo: "unico", monto: "Valor", gastosNegativos: true }, p_activo: true });
    expect(bien.error).toBeNull();
    expect((await admin.from("formatos_extracto").select("banco").eq("id", bien.data as string)).data).toEqual([{ banco: "Banco S6" }]);
    await sr.from("formatos_extracto").delete().eq("id", bien.data as string);
  });
});

describe("IA", () => {
  it("umbral y precios desde la consola, validados", async () => {
    expect((await soporte.rpc("consola_guardar_config_ia", { p_clave: "ia_umbral", p_valor: 90 })).error?.message).toMatch(/no tiene permiso/);
    expect((await contenido.rpc("consola_guardar_config_ia", { p_clave: "ia_umbral", p_valor: 30 })).error?.message).toMatch(/50 a 100/);
    expect((await contenido.rpc("consola_guardar_config_ia", { p_clave: "prueba_dias", p_valor: 3 })).error?.message).toMatch(/no existe/);
    expect((await contenido.rpc("consola_guardar_config_ia", { p_clave: "ia_umbral", p_valor: 90 })).error).toBeNull();
    expect(await config("ia_umbral")).toBe(90);
    expect((await contenido.rpc("consola_guardar_config_ia", { p_clave: "ia_precios", p_valor: { "modelo-s6": [2, 10] } })).error).toBeNull();
  });

  it("el costo sale de los precios de la consola y el tope frena las lecturas", async () => {
    expect((await admin.rpc("reservar_uso_ia", { p_hogar: hogar, p_tipo: "comprobante" })).error).toBeNull();
    expect((await admin.rpc("registrar_costo_ia", { p_hogar: hogar, p_modelo: "modelo-s6-1", p_entrada: 1_000_000, p_salida: 100_000, p_ms: 1200 })).error).toBeNull();
    const uso = (await sr.from("ia_usos").select("modelo, costo_usd, ms").eq("household_id", hogar).single()).data!;
    expect(uso).toMatchObject({ modelo: "modelo-s6-1", ms: 1200 });
    expect(Number(uso.costo_usd)).toBe(3); // 1M × 2 + 0,1M × 10, por millón

    await contenido.rpc("consola_guardar_config_ia", { p_clave: "ia_tope_usd_mes", p_valor: 0 });
    expect((await admin.rpc("reservar_uso_ia", { p_hogar: hogar, p_tipo: "comprobante" })).error?.message).toMatch(/en pausa/);
    await contenido.rpc("consola_guardar_config_ia", { p_clave: "ia_tope_usd_mes", p_valor: null });
    expect((await admin.rpc("reservar_uso_ia", { p_hogar: hogar, p_tipo: "comprobante" })).error).toBeNull();

    const ia = await soporte.rpc("consola_ia");
    expect(ia.error).toBeNull();
    expect((ia.data as { mes: { lecturas: number } }).mes.lecturas).toBeGreaterThan(0);
  });
});
