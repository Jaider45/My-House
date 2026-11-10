/**
 * Planes y límites (roadmap SaaS S2): la base hace cumplir los límites del plan aunque se salte la interfaz; la
 * prueba de Familia es una vez por hogar; un hogar suspendido queda en solo lectura; la consola respeta permisos.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conDosPasos, entornoDePrueba } from "./utilidades";

const entorno = entornoDePrueba();
let admin: SupabaseClient, editor: SupabaseClient, jefe: SupabaseClient, finanzas: SupabaseClient, soporte: SupabaseClient;
let hogar: string, editorId: string;

beforeAll(async () => {
  const a = await entorno.usuario("planes-admin");
  const e = await entorno.usuario("planes-editor");
  const j = await entorno.usuario("planes-jefe");
  const f = await entorno.usuario("planes-finanzas");
  const s = await entorno.usuario("planes-soporte");
  admin = a.db; editor = e.db; jefe = j.db; finanzas = f.db; soporte = s.db;
  hogar = await entorno.hogar(admin, "Hogar gratis", "gratis");
  editorId = (await editor.auth.getUser()).data.user!.id;

  const inv = await admin.from("invitations").insert({ household_id: hogar, email: e.email, rol: "editor" }).select("token").single();
  if (inv.error) throw inv.error;
  const ok = await editor.rpc("aceptar_invitacion", { p_token: inv.data.token, p_nombre: "Editora" });
  if (ok.error) throw ok.error;

  const ids = await Promise.all([jefe, finanzas, soporte].map(async (db) => (await db.auth.getUser()).data.user!.id));
  const st = await entorno.admin.from("platform_staff").insert([
    { user_id: ids[0], nombre: "Jefe planes", rol: "superadmin" },
    { user_id: ids[1], nombre: "Finanzas planes", rol: "finanzas" },
    { user_id: ids[2], nombre: "Soporte planes", rol: "soporte" },
  ]);
  if (st.error) throw st.error;
  await Promise.all([jefe, finanzas, soporte].map(conDosPasos));
});

afterAll(() => entorno.limpiar());

describe("límites del plan Gratis", () => {
  it("2 personas con acceso: una tercera invitación se rechaza", async () => {
    const r = await admin.from("invitations").insert({ household_id: hogar, email: "tercera@prueba.local", rol: "editor" });
    expect(r.error?.message).toMatch(/Tu plan Gratis permite 2 personas/);
    // Los dependientes (sin acceso) no cuentan.
    const dep = await admin.from("members").insert({ household_id: hogar, nombre: "Hija", es_dependiente: true });
    expect(dep.error).toBeNull();
  });

  it("5 lecturas con IA al mes", async () => {
    expect((await admin.rpc("reservar_uso_ia", { p_hogar: hogar, p_tipo: "comprobante", p_cantidad: 5 })).error).toBeNull();
    const r = await editor.rpc("reservar_uso_ia", { p_hogar: hogar, p_tipo: "comprobante" });
    expect(r.error?.message).toMatch(/Usaste las 5 lecturas con IA del plan Gratis/);
  });

  it("sin metas de ahorro", async () => {
    const r = await admin.from("budgets_goals").insert({ household_id: hogar, tipo: "meta", nombre: "Viaje", monto: 1_000_000, periodo: "mensual" });
    expect(r.error?.message).toMatch(/metas de ahorro son del plan Familia/);
  });

  it("nadie se cambia el plan con un update", async () => {
    const r = await admin.from("households").update({ plan: "familia" }).eq("id", hogar).select("id");
    expect(r.error?.message).toMatch(/no se cambia desde aquí/);
  });
});

describe("prueba de Familia", () => {
  it("solo la activa un admin, una vez, y abre los límites de Familia", async () => {
    expect((await editor.rpc("iniciar_prueba", { p_hogar: hogar })).error?.message).toMatch(/Solo un administrador/);
    expect((await admin.rpc("iniciar_prueba", { p_hogar: hogar })).error).toBeNull();
    const plan = await editor.rpc("mi_plan", { p_hogar: hogar });
    expect(plan.data).toMatchObject({ plan: "gratis", efectivo: "familia", prueba_usada: true });
    expect((await admin.rpc("iniciar_prueba", { p_hogar: hogar })).error?.message).toMatch(/ya usó su prueba/);

    const meta = await admin.from("budgets_goals").insert({ household_id: hogar, tipo: "meta", nombre: "Viaje", monto: 1_000_000, periodo: "mensual" });
    expect(meta.error).toBeNull();
    expect((await editor.rpc("reservar_uso_ia", { p_hogar: hogar, p_tipo: "comprobante" })).error).toBeNull();
  });
});

describe("consola: hogares, usuarios y planes", () => {
  it("lista y detalle sin datos financieros", async () => {
    const lista = await soporte.rpc("consola_hogares", { p_buscar: "Hogar gratis", p_filtro: "prueba" });
    expect(lista.error).toBeNull();
    expect(lista.data!.map((h: { id: string }) => h.id)).toContain(hogar);
    const det = await soporte.rpc("consola_hogar", { p_id: hogar });
    expect(det.error).toBeNull();
    const texto = JSON.stringify(det.data);
    expect(texto).not.toMatch(/monto|saldo/);
    expect((det.data as { miembros: { email: string }[] }).miembros[0].email).toMatch(/•/);
  });

  it("cambiar el plan es de Finanzas (no de Soporte) y queda en el historial del hogar", async () => {
    expect((await soporte.rpc("consola_cambiar_plan", { p_id: hogar, p_plan: "familia", p_motivo: "Cortesía" })).error?.message).toMatch(/no tiene permiso/);
    expect((await finanzas.rpc("consola_cambiar_plan", { p_id: hogar, p_plan: "familia", p_motivo: "Cortesía beta" })).error).toBeNull();
    const det = await finanzas.rpc("consola_hogar", { p_id: hogar });
    expect((det.data as { historial: { accion: string }[] }).historial[0].accion).toBe("cambio_plan");
    // Con Familia, la tercera persona ya cabe.
    expect((await admin.from("invitations").insert({ household_id: hogar, email: "tercera@prueba.local", rol: "editor" })).error).toBeNull();
  });

  it("un hogar suspendido queda en solo lectura", async () => {
    expect((await finanzas.rpc("consola_suspender", { p_id: hogar, p_suspender: true, p_motivo: "Fraude con tarjeta" })).error).toBeNull();
    const cuenta = await admin.from("accounts").insert({ household_id: hogar, tipo: "efectivo", nombre: "Billetera" });
    expect(cuenta.error).not.toBeNull();
    const lee = await admin.from("households").select("estado").eq("id", hogar).single();
    expect(lee.data?.estado).toBe("suspendido");
    expect((await finanzas.rpc("consola_suspender", { p_id: hogar, p_suspender: false, p_motivo: null })).error).toBeNull();
    expect((await admin.from("accounts").insert({ household_id: hogar, tipo: "efectivo", nombre: "Billetera" })).error).toBeNull();
  });

  it("soporte restablece la 2FA de una cuenta; finanzas no", async () => {
    expect((await finanzas.rpc("consola_restablecer_2fa", { p_user: editorId })).error?.message).toMatch(/no tiene permiso/);
    expect((await soporte.rpc("consola_restablecer_2fa", { p_user: editorId })).error).toBeNull();
    const correo = await soporte.rpc("consola_ver_correo", { p_user: editorId });
    expect(correo.data).toMatch(/@prueba\.local$/);
    const aud = await jefe.rpc("consola_auditoria", { p_limite: 5 });
    expect(aud.data!.map((a: { accion: string }) => a.accion)).toEqual(expect.arrayContaining(["restablecio_2fa", "vio_correo"]));
  });

  it("los planes los edita Finanzas; Gratis sigue siendo gratis", async () => {
    const planes = await finanzas.rpc("consola_planes");
    const familia = planes.data!.find((p: { codigo: string }) => p.codigo === "familia");
    const r = await finanzas.rpc("consola_guardar_plan", {
      p_codigo: "familia", p_nombre: "Familia", p_mensual: familia.precio_mensual, p_anual: familia.precio_anual,
      p_limites: familia.limites, p_publicado: true,
    });
    expect(r.error).toBeNull();
    const gratis = await jefe.rpc("consola_guardar_plan", { p_codigo: "gratis", p_nombre: "Gratis", p_mensual: 100, p_anual: 0, p_limites: {}, p_publicado: true });
    expect(gratis.error?.message).toMatch(/siempre es gratis/);
    expect((await soporte.rpc("consola_guardar_config", { p_clave: "prueba_dias", p_valor: 30 })).error?.message).toMatch(/no tiene permiso/);
  });
});
