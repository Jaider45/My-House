/**
 * Seguridad de punta a punta contra la base local: revisión automática de la configuración, API sin sesión,
 * intentos de cambiar el plan sin pagar, inyección en búsquedas y filtros, y secretos de integraciones.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conDosPasos, entornoDePrueba } from "./utilidades";

const entorno = entornoDePrueba();
const sr = entorno.admin;
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
let admin: SupabaseClient, jefe: SupabaseClient, soporte: SupabaseClient;
let hogar: string;

beforeAll(async () => {
  const a = await entorno.usuario("seg-admin");
  const j = await entorno.usuario("seg-jefe");
  const s = await entorno.usuario("seg-soporte");
  admin = a.db; jefe = j.db; soporte = s.db;
  hogar = await entorno.hogar(admin, "Hogar seguridad", "gratis");
  const [jid, sid] = await Promise.all([jefe, soporte].map(async (db) => (await db.auth.getUser()).data.user!.id));
  await sr.from("platform_staff").insert([
    { user_id: jid, nombre: "Jefe seguridad", rol: "superadmin" },
    { user_id: sid, nombre: "Soporte seguridad", rol: "soporte" },
  ]);
  await Promise.all([jefe, soporte].map(conDosPasos));
});

afterAll(async () => {
  await jefe.rpc("consola_desconectar_integracion", { p_proveedor: "anthropic" });
  await entorno.limpiar();
});

describe("revisión automática de la configuración", () => {
  it("sin hallazgos: RLS en todo, vistas con security_invoker, nada expuesto a anon, search_path fijo, bucket privado", async () => {
    const { data, error } = await sr.rpc("revision_seguridad");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("la revisión y las funciones del servidor no las llama nadie más", async () => {
    for (const db of [anon, admin]) {
      expect((await db.rpc("revision_seguridad")).error).not.toBeNull();
      expect((await db.rpc("integracion_leer", { p_proveedor: "resend" })).error).not.toBeNull();
      expect((await db.rpc("procesar_vencimientos", { p_hoy: "2026-01-01" })).error).not.toBeNull();
      expect((await db.rpc("correos_de_usuarios", { p_ids: [] })).error).not.toBeNull();
    }
  });
});

describe("API sin sesión (llave pública)", () => {
  it.each(["households", "members", "transactions", "accounts", "suscripciones", "cobros", "cupones", "auditoria", "integraciones", "platform_staff", "ia_usos", "avisos_enviados"])(
    "%s: no devuelve datos",
    async (tabla) => {
      const { data } = await anon.from(tabla).select("*").limit(5);
      expect(data ?? []).toEqual([]);
    },
  );

  it("solo los planes publicados son públicos (precios)", async () => {
    const { data } = await anon.from("planes").select("codigo, precio_mensual");
    expect((data ?? []).map((p) => p.codigo)).toContain("familia");
  });

  it("sin sesión no se crea nada", async () => {
    expect((await anon.rpc("crear_hogar", { p_nombre: "x", p_nombre_miembro: "x" })).error).not.toBeNull();
    expect((await anon.from("households").insert({ nombre: "x" })).error).not.toBeNull();
  });
});

describe("cambiar el plan sin pagar", () => {
  it("ningún camino directo funciona", async () => {
    expect((await admin.from("households").update({ plan: "familia" }).eq("id", hogar)).error).not.toBeNull();
    expect((await admin.from("households").update({ prueba_hasta: "2099-01-01" }).eq("id", hogar)).error).not.toBeNull();
    expect((await admin.from("suscripciones").insert({ household_id: hogar, plan: "familia", periodo: "anual", desde: "2026-01-01", vence: "2099-01-01", monto_periodo: 0 })).error).not.toBeNull();
    expect((await admin.from("cobros").insert({ household_id: hogar, referencia: "MH-HACK", plan: "familia", periodo: "anual", motivo: "alta", precio: 0, monto: 0 })).error).not.toBeNull();
    expect((await admin.rpc("registrar_pago_wompi", { p_evento: "x", p_referencia: "x", p_transaccion: "x", p_estado: "APPROVED", p_monto_centavos: 0, p_metodo: "x", p_detalle: "x", p_payload: {} })).error).not.toBeNull();
    expect((await admin.rpc("consola_cambiar_plan", { p_id: hogar, p_plan: "familia", p_motivo: "yo mismo" })).error).not.toBeNull();
    // El precio lo calcula la base: el cliente solo dice qué plan quiere.
    const c = await admin.rpc("crear_cobro", { p_hogar: hogar, p_plan: "familia", p_periodo: "mensual" });
    expect((c.data as { monto: number }).monto).toBe(19_900);
    const p = await admin.rpc("mi_plan", { p_hogar: hogar });
    expect((p.data as { efectivo: string }).efectivo).toBe("gratis");
  });

  it("muchos intentos de pago seguidos se frenan", async () => {
    let ultimo: { message?: string } | null = null;
    for (let i = 0; i < 21; i++) ultimo = (await admin.rpc("crear_cobro", { p_hogar: hogar, p_plan: "familia", p_periodo: "mensual" })).error;
    expect(ultimo?.message).toMatch(/demasiados intentos/);
  });
});

describe("inyección", () => {
  it("texto con SQL en búsquedas es solo texto", async () => {
    const q = "'; drop table public.households; --";
    const r = await jefe.rpc("consola_hogares", { p_buscar: q, p_filtro: "todos" });
    expect(r.error).toBeNull();
    expect(r.data).toEqual([]);
    expect((await sr.from("households").select("id").eq("id", hogar)).data).toHaveLength(1);
    expect((await jefe.rpc("consola_usuarios", { p_buscar: "%' or 1=1 --", p_filtro: "x' or '1'='1" })).error).toBeNull();
  });

  it("un id que no es UUID no pasa el filtro", async () => {
    const r = await admin.from("accounts").select("id").eq("id", "1 or 1=1");
    expect(r.error?.message).toMatch(/uuid/i);
  });
});

describe("secretos de integraciones", () => {
  it("solo quien tiene el permiso Sistema conecta; el secreto nunca vuelve a la consola", async () => {
    expect((await soporte.rpc("consola_guardar_integracion", { p_proveedor: "anthropic", p_config: {}, p_secretos: { api_key: "x" }, p_activa: true })).error?.message).toMatch(/no tiene permiso/);
    expect((await admin.rpc("consola_integraciones")).error?.message).toMatch(/No tienes acceso/);

    const llave = "sk-ant-prueba-1234567890-ABCD";
    expect((await jefe.rpc("consola_guardar_integracion", { p_proveedor: "anthropic", p_config: { modelo: "claude-opus-5-5" }, p_secretos: { api_key: llave }, p_activa: true })).error).toBeNull();
    const lista = await jefe.rpc("consola_integraciones");
    const texto = JSON.stringify(lista.data);
    expect(texto).not.toContain(llave);
    expect(texto).toContain("…ABCD");

    const leida = await sr.rpc("integracion_leer", { p_proveedor: "anthropic" });
    expect((leida.data as { secretos: { api_key: string } }).secretos.api_key).toBe(llave);
    // En la tabla no queda el valor (está cifrado en Vault).
    expect(JSON.stringify((await sr.from("integraciones").select("*").eq("proveedor", "anthropic").single()).data)).not.toContain(llave);
  });

  it("un secreto vacío conserva el anterior; campos fuera de la lista se rechazan", async () => {
    expect((await jefe.rpc("consola_guardar_integracion", { p_proveedor: "anthropic", p_config: { modelo: "otro" }, p_secretos: { api_key: "" }, p_activa: true })).error).toBeNull();
    const leida = await sr.rpc("integracion_leer", { p_proveedor: "anthropic" });
    expect((leida.data as { secretos: { api_key: string } }).secretos.api_key).toBe("sk-ant-prueba-1234567890-ABCD");
    expect((await jefe.rpc("consola_guardar_integracion", { p_proveedor: "anthropic", p_config: { otra: "x" }, p_secretos: {}, p_activa: true })).error?.message).toMatch(/no permitido/);
    expect((await jefe.rpc("consola_guardar_integracion", { p_proveedor: "github", p_config: {}, p_secretos: {}, p_activa: true })).error?.message).toMatch(/no existe/);
  });

  it("desconectar borra el secreto de Vault y queda en la auditoría", async () => {
    expect((await jefe.rpc("consola_desconectar_integracion", { p_proveedor: "anthropic" })).error).toBeNull();
    expect((await sr.rpc("integracion_leer", { p_proveedor: "anthropic" })).data).toBeNull();
    const aud = await jefe.rpc("consola_auditoria", { p_limite: 5 });
    expect(aud.data!.map((a: { accion: string }) => a.accion)).toEqual(expect.arrayContaining(["desconecto_integracion", "edito_integracion", "conecto_integracion"]));
  });
});
