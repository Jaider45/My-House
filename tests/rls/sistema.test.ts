/**
 * Sistema (roadmap SaaS S8): una función nueva se enciende para un porcentaje de hogares sin desplegar; el mismo hogar
 * cae siempre igual; por plan o solo para el equipo. Solo el superadmin la cambia.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conDosPasos, entornoDePrueba } from "./utilidades";

const entorno = entornoDePrueba();
const sr = entorno.admin;
let gratis: SupabaseClient, familia: SupabaseClient, superadmin: SupabaseClient, soporte: SupabaseClient;
const CLAVE = "prueba_s8_flag";

const guardar = (db: SupabaseClient, cambios: Partial<{ activa: boolean; planes: string[]; porcentaje: number; solo_equipo: boolean }>) =>
  db.rpc("consola_guardar_funcion", {
    p_clave: CLAVE, p_descripcion: "Prueba", p_activa: true, p_planes: [], p_porcentaje: 100, p_solo_equipo: false,
    ...Object.fromEntries(Object.entries(cambios).map(([k, v]) => [`p_${k}`, v])),
  });
const tiene = async (db: SupabaseClient) => ((await db.rpc("mis_funciones")).data as string[]).includes(CLAVE);

beforeAll(async () => {
  const g = await entorno.usuario("s8-gratis");
  const f = await entorno.usuario("s8-familia");
  const s = await entorno.usuario("s8-super");
  const so = await entorno.usuario("s8-soporte");
  gratis = g.db; familia = f.db; superadmin = s.db; soporte = so.db;
  await entorno.hogar(gratis, "Hogar S8 gratis", "gratis");
  await entorno.hogar(familia, "Hogar S8 familia", "familia");
  await entorno.hogar(superadmin, "Hogar del superadmin", "gratis");
  const ids = await Promise.all([superadmin, soporte].map(async (db) => (await db.auth.getUser()).data.user!.id));
  await sr.from("platform_staff").insert([
    { user_id: ids[0], nombre: "Super S8", rol: "superadmin" },
    { user_id: ids[1], nombre: "Soporte S8", rol: "soporte" },
  ]);
  await Promise.all([superadmin, soporte].map(conDosPasos));
  for (const db of [gratis, familia, superadmin]) await db.auth.refreshSession();
});

afterAll(async () => {
  await sr.from("funciones").delete().eq("clave", CLAVE);
  await entorno.limpiar();
});

describe("feature flags", () => {
  it("solo el superadmin las cambia; nadie lee la tabla", async () => {
    expect((await guardar(soporte, {})).error?.message).toMatch(/no tiene permiso/);
    expect((await guardar(superadmin, { planes: ["inexistente"] })).error?.message).toMatch(/no existe/);
    expect((await guardar(superadmin, { porcentaje: 101 })).error?.message).toMatch(/0 a 100/);
    expect((await gratis.from("funciones").select("clave")).data ?? []).toEqual([]);
  });

  it("100 % a todos; 0 % a nadie salvo el equipo; apagada a nadie", async () => {
    await guardar(superadmin, { porcentaje: 100 });
    expect([await tiene(gratis), await tiene(familia)]).toEqual([true, true]);
    await guardar(superadmin, { porcentaje: 0 });
    expect([await tiene(gratis), await tiene(familia), await tiene(superadmin)]).toEqual([false, false, true]);
    await guardar(superadmin, { activa: false });
    expect(await tiene(superadmin)).toBe(false);
  });

  it("por plan y solo equipo", async () => {
    await guardar(superadmin, { planes: ["familia"] });
    expect([await tiene(gratis), await tiene(familia)]).toEqual([false, true]);
    await guardar(superadmin, { solo_equipo: true });
    expect([await tiene(gratis), await tiene(familia), await tiene(superadmin)]).toEqual([false, false, true]);
  });

  it("el porcentaje es estable: quien la tiene al 50 % la sigue teniendo al 80 %", async () => {
    await guardar(superadmin, { porcentaje: 50 });
    const antes = [await tiene(gratis), await tiene(familia)];
    await guardar(superadmin, { porcentaje: 80 });
    const despues = [await tiene(gratis), await tiene(familia)];
    antes.forEach((t, i) => t && expect(despues[i]).toBe(true));
    const lista = (await superadmin.rpc("consola_funciones")).data as { clave: string; hogares: number }[];
    expect(lista.find((f) => f.clave === CLAVE)!.hogares).toBeGreaterThanOrEqual(despues.filter(Boolean).length);
  });

  it("estado del sistema solo para el superadmin", async () => {
    expect((await soporte.rpc("consola_sistema")).error?.message).toMatch(/no tiene permiso/);
    const s = await superadmin.rpc("consola_sistema");
    expect(s.error).toBeNull();
    expect(s.data).toHaveProperty("colas");
  });
});
