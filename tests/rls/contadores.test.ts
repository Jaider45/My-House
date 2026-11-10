/**
 * Contadores (roadmap SaaS S5): hogar activo por usuario, panel de clientes, enlace de referidos, límite de
 * clientes del plan y comisiones liquidadas desde la consola.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conDosPasos, entornoDePrueba } from "./utilidades";

const entorno = entornoDePrueba();
const sr = entorno.admin;
let ana: SupabaseClient, contadora: SupabaseClient, finanzas: SupabaseClient;
let contadoraEmail: string;
let hogarAna: string, firma: string;

async function invitarYAceptar(desde: SupabaseClient, hogar: string, email: string, db: SupabaseClient, nombre: string) {
  const inv = await desde.from("invitations").insert({ household_id: hogar, email, rol: "contador" }).select("token").single();
  if (inv.error) throw inv.error;
  return db.rpc("aceptar_invitacion", { p_token: inv.data.token, p_nombre: nombre });
}

beforeAll(async () => {
  const a = await entorno.usuario("cont-ana");
  const c = await entorno.usuario("cont-contadora");
  const f = await entorno.usuario("cont-finanzas");
  ana = a.db; contadora = c.db; finanzas = f.db; contadoraEmail = c.email;
  hogarAna = await entorno.hogar(ana, "Hogar Ana contadores");
  firma = await entorno.hogar(contadora, "Ruiz Contadores prueba", "contador");

  const fid = (await finanzas.auth.getUser()).data.user!.id;
  await sr.from("platform_staff").insert({ user_id: fid, nombre: "Finanzas contadores", rol: "finanzas" });
  await conDosPasos(finanzas);
});

afterAll(() => entorno.limpiar());

describe("hogar activo", () => {
  it("elegir_hogar exige ser miembro y mis_hogares_lista marca el activo", async () => {
    expect((await contadora.rpc("elegir_hogar", { p_hogar: hogarAna })).error?.message).toMatch(/No perteneces/);
    const aceptado = await invitarYAceptar(ana, hogarAna, contadoraEmail, contadora, "Contadora");
    expect(aceptado.error).toBeNull();

    // La firma sigue siendo el hogar activo (aceptar una invitación no te cambia de hogar).
    let lista = await contadora.rpc("mis_hogares_lista");
    expect(lista.data!.find((h: { id: string; activo: boolean }) => h.id === firma)!.activo).toBe(true);

    expect((await contadora.rpc("elegir_hogar", { p_hogar: hogarAna })).error).toBeNull();
    lista = await contadora.rpc("mis_hogares_lista");
    expect(lista.data!.find((h: { id: string; activo: boolean }) => h.id === hogarAna)!.activo).toBe(true);
    await contadora.rpc("elegir_hogar", { p_hogar: firma });
  });

  it("mis_clientes lista solo los hogares donde soy contadora", async () => {
    const r = await contadora.rpc("mis_clientes");
    expect(r.data!.map((c: { id: string }) => c.id)).toEqual([hogarAna]);
    expect((await ana.rpc("mis_clientes")).data).toEqual([]);
  });
});

describe("referidos y firma", () => {
  let codigo: string;

  it("el código de referido es del plan Contador y se crea una vez", async () => {
    expect((await ana.rpc("obtener_ref", { p_hogar: hogarAna })).error?.message).toMatch(/plan Contador/);
    const r = await contadora.rpc("obtener_ref", { p_hogar: firma });
    expect(r.error).toBeNull();
    codigo = r.data as string;
    expect(codigo).toMatch(/^[A-Z0-9]{6,12}$/);
    expect((await contadora.rpc("obtener_ref", { p_hogar: firma })).data).toBe(codigo);
  });

  it("registrarse con el enlace deja referido_por y canal contador", async () => {
    const nuevo = await entorno.usuario("cont-referida");
    const { data: h, error } = await nuevo.db.rpc("crear_hogar", { p_nombre: "Hogar referido", p_nombre_miembro: "Referida", p_ref: codigo.toLowerCase() });
    expect(error).toBeNull();
    entorno.recordarHogar(h as string);
    const fila = (await sr.from("households").select("canal, referido_por").eq("id", h as string).single()).data!;
    expect(fila).toEqual({ canal: "contador", referido_por: firma });

    const f = await contadora.rpc("mi_firma");
    expect(f.data).toMatchObject({ id: firma, ref_codigo: codigo, referidos: 1, clientes: 1 });
    expect((await ana.rpc("mi_firma")).data).toBeNull();
  });
});

describe("límite de clientes del plan", () => {
  it("con el tope del plan alcanzado, otra invitación de contador se rechaza", async () => {
    const { data: plan } = await sr.from("planes").select("limites").eq("codigo", "contador").single();
    const limites = plan!.limites as Record<string, unknown>;
    await sr.from("planes").update({ limites: { ...limites, hogares: 1 } }).eq("codigo", "contador");
    try {
      const otra = await entorno.usuario("cont-otro-hogar");
      const hogarOtro = await entorno.hogar(otra.db, "Hogar segundo cliente");
      const r = await invitarYAceptar(otra.db, hogarOtro, contadoraEmail, contadora, "Contadora");
      expect(r.error?.message).toMatch(/permite 1 hogares clientes/);
      // Un contador sin firma no tiene tope.
      const libre = await entorno.usuario("cont-libre");
      const r2 = await invitarYAceptar(otra.db, hogarOtro, libre.email, libre.db, "Contador libre");
      expect(r2.error).toBeNull();
    } finally {
      await sr.from("planes").update({ limites }).eq("codigo", "contador");
    }
  });
});

describe("comisiones", () => {
  it("se liquidan por mes terminado con el % del plan y la firma las ve", async () => {
    const referido = (await sr.from("households").select("id").eq("referido_por", firma).single()).data!.id;
    const mesPasado = new Date();
    mesPasado.setUTCMonth(mesPasado.getUTCMonth() - 1, 15);
    const pagado = mesPasado.toISOString();
    await sr.from("cobros").insert({
      household_id: referido, referencia: `MH-COMIS${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      plan: "familia", periodo: "mensual", motivo: "alta", precio: 19_900, descuento: 0, monto: 19_900,
      estado: "pagado", pagado_en: pagado,
    });

    const mes = `${pagado.slice(0, 7)}-01`;
    expect((await finanzas.rpc("consola_liquidar_comisiones", { p_mes: new Date().toISOString().slice(0, 10) })).error?.message).toMatch(/mes ya terminado/);
    const r = await finanzas.rpc("consola_liquidar_comisiones", { p_mes: mes });
    expect(r.error).toBeNull();

    const fila = (await sr.from("comisiones").select("*").eq("firma", firma).eq("mes", mes).single()).data!;
    expect(fila).toMatchObject({ pct: 20, hogares: 1, base: 19_900, monto: 3_980, estado: "pendiente" });

    // La firma ve su comisión; otro hogar no ve nada.
    expect((await contadora.from("comisiones").select("monto").eq("firma", firma)).data).toEqual([{ monto: 3_980 }]);
    expect((await ana.from("comisiones").select("id")).data).toEqual([]);

    expect((await finanzas.rpc("consola_marcar_comision", { p_id: fila.id, p_pagada: true })).error).toBeNull();
    expect((await sr.from("comisiones").select("estado").eq("id", fila.id).single()).data!.estado).toBe("pagada");

    const consola = await finanzas.rpc("consola_contadores");
    const firmas = (consola.data as { firmas: { id: string; referidos: number }[] }).firmas;
    expect(firmas.find((f) => f.id === firma)).toMatchObject({ referidos: 1, verificada: false });
    expect((await finanzas.rpc("consola_verificar_contador", { p_id: firma, p_verificada: true })).error).toBeNull();
  });
});
