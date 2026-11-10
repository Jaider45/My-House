/**
 * Consola del equipo (roadmap SaaS S1): solo personas activas del equipo, con AAL2 y el permiso de su rol, usan las
 * funciones consola_*; la auditoría registra todo y no se puede editar; la matriz SQL coincide con la de TS.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MATRIZ } from "../../src/lib/consola/permisos";
import { conDosPasos, entornoDePrueba } from "./utilidades";

const entorno = entornoDePrueba();

let jefe: SupabaseClient, soporte: SupabaseClient, cliente: SupabaseClient;
let jefeId: string, soporteId: string;
let soporteEmail: string;

beforeAll(async () => {
  const j = await entorno.usuario("consola-jefe");
  const s = await entorno.usuario("consola-soporte");
  const c = await entorno.usuario("consola-cliente");
  jefe = j.db; soporte = s.db; cliente = c.db; soporteEmail = s.email;
  jefeId = (await jefe.auth.getUser()).data.user!.id;
  soporteId = (await soporte.auth.getUser()).data.user!.id;
  // El primer superadmin lo crea el script con service_role.
  const { error } = await entorno.admin.from("platform_staff").insert({ user_id: jefeId, nombre: "Jefe de prueba", rol: "superadmin" });
  if (error) throw error;
});

afterAll(() => entorno.limpiar());

describe("acceso a las funciones de la consola", () => {
  it("una cuenta de cliente no entra", async () => {
    const r = await cliente.rpc("consola_equipo");
    expect(r.error?.message).toMatch(/No tienes acceso a la consola/);
  });

  it("alguien del equipo sin el segundo factor (AAL1) tampoco", async () => {
    const r = await jefe.rpc("consola_equipo");
    expect(r.error?.message).toMatch(/dos pasos/);
  });

  it("con AAL2 entra, y la matriz de la base es la misma de la interfaz", async () => {
    await conDosPasos(jefe);
    const equipo = await jefe.rpc("consola_equipo");
    expect(equipo.error).toBeNull();
    expect(equipo.data!.some((p: { user_id: string }) => p.user_id === jefeId)).toBe(true);

    const m = await jefe.rpc("consola_matriz_permisos");
    expect(m.error).toBeNull();
    const deLaBase = Object.fromEntries(m.data!.map((f: { rol: string; permisos: string[] }) => [f.rol, [...f.permisos].sort()]));
    const deTs = Object.fromEntries(Object.entries(MATRIZ).map(([rol, p]) => [rol, [...p].sort()]));
    expect(deLaBase).toEqual(deTs);
  });

  it("nadie se agrega al equipo ni lee la auditoría directamente", async () => {
    const r1 = await cliente.from("platform_staff").insert({ user_id: (await cliente.auth.getUser()).data.user!.id, nombre: "Yo", rol: "superadmin" });
    expect(r1.error).not.toBeNull();
    const r2 = await jefe.from("auditoria").select("id").limit(1);
    expect(r2.error).not.toBeNull();
    const r3 = await cliente.from("platform_staff").select("user_id");
    expect(r3.data ?? []).toEqual([]);
  });
});

describe("invitaciones y roles", () => {
  let token: string;

  it("el superadmin invita; la invitación solo la acepta el mismo correo", async () => {
    const inv = await jefe.rpc("consola_invitar", { p_email: soporteEmail.toUpperCase(), p_nombre: "Daniela Soporte", p_rol: "soporte" });
    expect(inv.error).toBeNull();
    token = inv.data as string;

    const ver = await cliente.rpc("consola_ver_invitacion", { p_token: token }).single();
    expect(ver.data).toMatchObject({ nombre: "Daniela Soporte", rol: "soporte", vencida: false });
    expect((ver.data as { email: string }).email).not.toBe(soporteEmail); // enmascarado

    const otro = await cliente.rpc("consola_aceptar_invitacion", { p_token: token });
    expect(otro.error?.message).toMatch(/Esta invitación es para/);

    const acepta = await soporte.rpc("consola_aceptar_invitacion", { p_token: token });
    expect(acepta.error).toBeNull();
    expect(acepta.data).toBe("soporte");

    const otraVez = await soporte.rpc("consola_aceptar_invitacion", { p_token: token });
    expect(otraVez.error?.message).toMatch(/no existe o ya fue usada/);
  });

  it("soporte no gestiona el equipo ni ve la auditoría", async () => {
    await soporte.auth.refreshSession();
    await conDosPasos(soporte);
    expect((await soporte.rpc("consola_equipo")).error).toBeNull();
    const inv = await soporte.rpc("consola_invitar", { p_email: "x@prueba.local", p_nombre: "X", p_rol: "superadmin" });
    expect(inv.error?.message).toMatch(/Tu rol no tiene permiso/);
    const aud = await soporte.rpc("consola_auditoria", {});
    expect(aud.error?.message).toMatch(/Tu rol no tiene permiso/);
  });

  it("nadie se cambia el rol a sí mismo; el superadmin sí cambia el de otros", async () => {
    expect((await jefe.rpc("consola_cambiar_rol", { p_user: jefeId, p_rol: "soporte" })).error?.message).toMatch(/propio rol/);
    expect((await jefe.rpc("consola_cambiar_rol", { p_user: soporteId, p_rol: "contenido" })).error).toBeNull();
  });

  it("desactivar corta el acceso de inmediato, aunque su token siga vigente", async () => {
    expect((await jefe.rpc("consola_activar", { p_user: soporteId, p_activo: false })).error).toBeNull();
    expect((await soporte.rpc("consola_equipo")).error?.message).toMatch(/No tienes acceso/);
    expect((await jefe.rpc("consola_activar", { p_user: soporteId, p_activo: true })).error).toBeNull();
    expect((await soporte.rpc("consola_equipo")).error).toBeNull();
  });

  it("todo quedó en la auditoría, con la IP que manda la app", async () => {
    const aud = await jefe.rpc("consola_auditoria", { p_limite: 50 });
    expect(aud.error).toBeNull();
    const mias = aud.data!.filter((a: { objeto_nombre: string | null }) => a.objeto_nombre === "Daniela Soporte").map((a: { accion: string }) => a.accion);
    expect(mias).toEqual(expect.arrayContaining(["invito_persona", "acepto_invitacion", "cambio_rol", "desactivo_persona", "reactivo_persona"]));
  });
});

describe("auditoría inmutable", () => {
  it("ni service_role la edita ni la borra", async () => {
    const { data } = await entorno.admin.from("auditoria").select("id").order("id", { ascending: false }).limit(1).single();
    const upd = await entorno.admin.from("auditoria").update({ accion: "borrado" }).eq("id", data!.id);
    expect(upd.error?.message).toMatch(/no se puede modificar/);
    const del = await entorno.admin.from("auditoria").delete().eq("id", data!.id);
    expect(del.error?.message).toMatch(/no se puede modificar/);
  });

  it("guarda la IP y el navegador que llegan en las cabeceras de la consola", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const conIp = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
      global: { headers: { "x-mh-ip": "181.52.10.20", "x-mh-agente": "Prueba/1.0" } },
    });
    const sesion = (await jefe.auth.getSession()).data.session!;
    await conIp.auth.setSession({ access_token: sesion.access_token, refresh_token: sesion.refresh_token });
    expect((await conIp.rpc("consola_registrar_ingreso")).error).toBeNull();
    const ultimo = await jefe.rpc("consola_auditoria", { p_limite: 1 }).single();
    expect(ultimo.data).toMatchObject({ accion: "ingreso_consola", ip: "181.52.•.•" });
  });
});
