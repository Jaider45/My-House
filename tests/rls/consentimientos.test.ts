/**
 * Bases legales (roadmap SaaS S0): la autorización de la Ley 1581 queda como prueba (versión, fecha, IP) y nadie
 * la puede escribir, cambiar ni ver la de otra persona por la API.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { entornoDePrueba } from "./utilidades";

const entorno = entornoDePrueba();
const sr = entorno.admin;
let ana: SupabaseClient, beto: SupabaseClient, idAna: string, idBeto: string;
const registrados: string[] = [];

beforeAll(async () => {
  ({ db: ana } = await entorno.usuario("consent-ana"));
  ({ db: beto } = await entorno.usuario("consent-beto"));
  idAna = (await ana.auth.getUser()).data.user!.id;
  idBeto = (await beto.auth.getUser()).data.user!.id;
});

afterAll(async () => {
  for (const id of registrados) await sr.auth.admin.deleteUser(id);
  await entorno.limpiar();
});

describe("consentimientos", () => {
  it("el registro con correo guarda la autorización que trae en los metadatos", async () => {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const email = `consent-reg-${Math.random().toString(36).slice(2, 8)}@prueba.local`;
    const { data, error } = await anon.auth.signUp({
      email,
      password: "Clave-de-prueba-123",
      options: { data: { nombre: "Reg", consentimiento: { version: "2026-11-11", comunicaciones: true, ip: "203.0.113.7", agente: "vitest" } } },
    });
    expect(error).toBeNull();
    registrados.push(data.user!.id);
    const { data: filas } = await sr.from("consentimientos").select("tipo, version, aceptado, origen, ip").eq("user_id", data.user!.id).order("tipo");
    expect(filas).toEqual([
      { tipo: "comunicaciones", version: "2026-11-11", aceptado: true, origen: "registro", ip: "203.0.113.7" },
      { tipo: "politica_datos", version: "2026-11-11", aceptado: true, origen: "registro", ip: "203.0.113.7" },
      { tipo: "terminos", version: "2026-11-11", aceptado: true, origen: "registro", ip: "203.0.113.7" },
    ]);
  });

  it("sin consentimiento en los metadatos (Google, admin) no se inventa ninguno", async () => {
    const { count } = await sr.from("consentimientos").select("id", { count: "exact", head: true }).eq("user_id", idAna);
    expect(count).toBe(0);
  });

  it("desde la app se acepta con aceptar_consentimientos y cada quien ve solo los suyos", async () => {
    const { error } = await ana.rpc("aceptar_consentimientos", { p_version: "2026-11-11", p_comunicaciones: false });
    expect(error).toBeNull();
    const { data: propios } = await ana.from("consentimientos").select("tipo, aceptado, origen").order("tipo");
    expect(propios).toEqual([
      { tipo: "comunicaciones", aceptado: false, origen: "app" },
      { tipo: "politica_datos", aceptado: true, origen: "app" },
      { tipo: "terminos", aceptado: true, origen: "app" },
    ]);
    const { data: ajenos } = await beto.from("consentimientos").select("id").eq("user_id", idAna);
    expect(ajenos).toEqual([]);
  });

  it("rechaza versiones mal formadas", async () => {
    const { error } = await beto.rpc("aceptar_consentimientos", { p_version: "v1", p_comunicaciones: false });
    expect(error?.message).toMatch(/Versión/);
  });

  it("nadie escribe ni borra por la API, y ni el servidor puede modificar uno", async () => {
    const ins = await beto.from("consentimientos").insert({ user_id: idBeto, tipo: "politica_datos", version: "2026-11-11", aceptado: true, origen: "app" });
    expect(ins.error).not.toBeNull();
    const del = await ana.from("consentimientos").delete().eq("user_id", idAna).select("id");
    expect(del.error ?? del.data).toBeTruthy();
    expect(del.data ?? []).toEqual([]);
    const upd = await sr.from("consentimientos").update({ aceptado: false }).eq("user_id", idAna).eq("tipo", "politica_datos");
    expect(upd.error?.message).toMatch(/no se modifican/);
  });

  it("la función no se puede llamar sin sesión", async () => {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { error } = await anon.rpc("aceptar_consentimientos", { p_version: "2026-11-11", p_comunicaciones: false });
    expect(error).not.toBeNull();
  });
});
