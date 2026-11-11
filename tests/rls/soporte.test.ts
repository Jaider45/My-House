/**
 * Soporte y privacidad (roadmap SaaS S7): tickets propios, notas internas que el hogar no ve, acceso a finanzas solo
 * con permiso del administrador (vence y se audita), y solicitudes de la Ley 1581 con plazo en días hábiles.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conDosPasos, entornoDePrueba } from "./utilidades";

const entorno = entornoDePrueba();
const sr = entorno.admin;
let admin: SupabaseClient, pareja: SupabaseClient, soporte: SupabaseClient, contenido: SupabaseClient, finanzas: SupabaseClient, sola: SupabaseClient;
let hogar: string, hogarSola: string, ticket: string;

/** Implementación independiente de los días hábiles de Colombia, para contrastar con la de la base. */
function pascua(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return new Date(Date.UTC(y, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1));
}
const mas = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const iso = (d: Date) => d.toISOString().slice(0, 10);
function festivos(y: number) {
  const lunes = (d: Date) => mas(d, (8 - (d.getUTCDay() || 7)) % 7);
  const e = pascua(y);
  const fijos = [[1, 1], [5, 1], [7, 20], [8, 7], [12, 8], [12, 25]].map(([m, d]) => new Date(Date.UTC(y, m - 1, d)));
  const movidos = [[1, 6], [3, 19], [6, 29], [8, 15], [10, 12], [11, 1], [11, 11]].map(([m, d]) => lunes(new Date(Date.UTC(y, m - 1, d))));
  return new Set([...fijos, ...movidos, mas(e, -3), mas(e, -2), mas(e, 43), mas(e, 64), mas(e, 71)].map(iso));
}
function sumarHabiles(desde: string, n: number) {
  let d = new Date(`${desde}T00:00:00Z`);
  while (n > 0) {
    d = mas(d, 1);
    if (d.getUTCDay() % 6 !== 0 && !festivos(d.getUTCFullYear()).has(iso(d))) n--;
  }
  return iso(d);
}
const hoyBogota = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

beforeAll(async () => {
  const a = await entorno.usuario("sop-admin");
  const p = await entorno.usuario("sop-pareja");
  const s = await entorno.usuario("sop-soporte");
  const c = await entorno.usuario("sop-contenido");
  const f = await entorno.usuario("sop-finanzas");
  const so = await entorno.usuario("sop-sola");
  admin = a.db; pareja = p.db; soporte = s.db; contenido = c.db; finanzas = f.db; sola = so.db;
  hogar = await entorno.hogar(admin, "Hogar soporte");
  hogarSola = await entorno.hogar(sola, "Hogar de la titular");
  const inv = await admin.from("invitations").insert({ household_id: hogar, email: p.email, rol: "editor" }).select("token").single();
  await pareja.rpc("aceptar_invitacion", { p_token: inv.data!.token, p_nombre: "Pareja" });

  const ids = await Promise.all([soporte, contenido, finanzas].map(async (db) => (await db.auth.getUser()).data.user!.id));
  await sr.from("platform_staff").insert([
    { user_id: ids[0], nombre: "Soporte S7", rol: "soporte" },
    { user_id: ids[1], nombre: "Contenido S7", rol: "contenido" },
    { user_id: ids[2], nombre: "Finanzas S7", rol: "finanzas" },
  ]);
  await Promise.all([soporte, contenido, finanzas].map(conDosPasos));
});

afterAll(() => entorno.limpiar());

describe("días hábiles", () => {
  it("la base y una implementación independiente coinciden (festivos 2026 y 2027)", () => {
    expect([...festivos(2026)].sort()).toEqual(
      ["2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03", "2026-05-01", "2026-05-18", "2026-06-08", "2026-06-15",
       "2026-06-29", "2026-07-20", "2026-08-07", "2026-08-17", "2026-10-12", "2026-11-02", "2026-11-16", "2026-12-08", "2026-12-25"],
    );
    expect(sumarHabiles("2026-11-10", 10)).toBe("2026-11-25"); // salta el festivo del lunes 16
  });
});

describe("tickets", () => {
  it("quien escribe ve su ticket; el resto del hogar no", async () => {
    const r = await pareja.rpc("crear_ticket", { p_hogar: hogar, p_asunto: "No puedo pagar", p_categoria: "cobros", p_cuerpo: "Wompi me rechaza la tarjeta." });
    expect(r.error).toBeNull();
    ticket = r.data as string;
    expect((await pareja.from("tickets").select("prioridad").eq("id", ticket).single()).data!.prioridad).toBe("alta");
    expect((await admin.from("tickets").select("id").eq("id", ticket)).data).toEqual([]);
    expect((await admin.rpc("crear_ticket", { p_hogar: hogarSola, p_asunto: "Ajeno", p_categoria: "otro", p_cuerpo: "No es mi hogar" })).error?.message).toMatch(/No perteneces/);
    expect((await pareja.from("tickets").insert({ asunto: "x", creado_nombre: "x", sla_vence: new Date().toISOString() })).error).not.toBeNull();
  });

  it("Soporte responde; la nota interna no la ve el hogar; Finanzas no ve tickets", async () => {
    expect((await finanzas.rpc("consola_tickets", { p_estado: "pendientes", p_asignado: "todos" })).error?.message).toMatch(/no tiene permiso/);
    const lista = await soporte.rpc("consola_tickets", { p_estado: "pendientes", p_asignado: "todos" });
    expect((lista.data as { tickets: { id: string }[] }).tickets.some((t) => t.id === ticket)).toBe(true);

    expect((await soporte.rpc("consola_responder_ticket", { p_id: ticket, p_cuerpo: "Revisar con Wompi", p_interno: true, p_estado: "abierto" })).data).toBeNull();
    const correo = await soporte.rpc("consola_responder_ticket", { p_id: ticket, p_cuerpo: "Prueba con PSE mientras revisamos.", p_interno: false, p_estado: "esperando_cliente" });
    expect(correo.data).toMatch(/sop-pareja/);
    const mensajes = (await pareja.from("ticket_mensajes").select("cuerpo, de_equipo").eq("ticket_id", ticket).order("id")).data!;
    expect(mensajes.map((m) => m.cuerpo)).toEqual(["Wompi me rechaza la tarjeta.", "Prueba con PSE mientras revisamos."]);

    await pareja.rpc("responder_ticket", { p_ticket: ticket, p_cuerpo: "Con PSE funcionó, gracias." });
    const t = (await pareja.from("tickets").select("estado, primera_respuesta").eq("id", ticket).single()).data!;
    expect(t.estado).toBe("abierto");
    expect(t.primera_respuesta).not.toBeNull();
  });

  it("registro técnico: el hogar escribe, no lee; soporte lo ve en el ticket", async () => {
    await pareja.rpc("registrar_error", { p_hogar: hogar, p_tipo: "importacion", p_mensaje: "Fecha no reconocida en 3 filas", p_detalle: { archivo: "extracto.csv" } });
    await pareja.rpc("registrar_error", { p_hogar: hogarSola, p_tipo: "ia", p_mensaje: "No debería quedar" });
    expect((await pareja.from("registro_tecnico").select("id").limit(1)).data ?? []).toEqual([]);
    const d = (await soporte.rpc("consola_ticket", { p_id: ticket })).data as { registro: { mensaje: string }[]; hogar: { nombre: string } };
    expect(d.hogar.nombre).toBe("Hogar soporte");
    expect(d.registro.map((r) => r.mensaje)).toEqual(["Fecha no reconocida en 3 filas"]);
    expect((await sr.from("registro_tecnico").select("id").eq("household_id", hogarSola)).data).toEqual([]);
  });
});

describe("acceso a datos financieros con permiso", () => {
  let acceso: string;

  it("sin permiso no hay datos; Contenido ni siquiera puede pedirlo", async () => {
    expect((await soporte.rpc("consola_ver_finanzas", { p_hogar: hogar })).error?.message).toMatch(/No tienes permiso/);
    expect((await contenido.rpc("consola_pedir_acceso", { p_hogar: hogar, p_motivo: "Quiero mirar los datos", p_horas: 24 })).error?.message).toMatch(/no tiene permiso/);
    const r = await soporte.rpc("consola_pedir_acceso", { p_hogar: hogar, p_motivo: "Revisar un movimiento duplicado del ticket", p_horas: 2 });
    expect(r.error).toBeNull();
    expect((r.data as string[]).some((c) => c.includes("sop-admin"))).toBe(true);
    expect((await soporte.rpc("consola_pedir_acceso", { p_hogar: hogar, p_motivo: "Otra vez lo mismo de antes", p_horas: 2 })).error?.message).toMatch(/pendiente/);
  });

  it("solo el administrador ve y aprueba; luego hay datos y cada vista se audita; revocar lo corta", async () => {
    expect((await pareja.from("accesos_soporte").select("id").eq("household_id", hogar)).data).toEqual([]);
    acceso = (await admin.from("accesos_soporte").select("id").eq("household_id", hogar).single()).data!.id;
    expect((await pareja.rpc("responder_acceso_soporte", { p_id: acceso, p_accion: "aprobar" })).error?.message).toMatch(/administrador/);
    expect((await admin.rpc("responder_acceso_soporte", { p_id: acceso, p_accion: "aprobar" })).error).toBeNull();

    const f = await soporte.rpc("consola_ver_finanzas", { p_hogar: hogar });
    expect(f.error).toBeNull();
    expect(f.data).toHaveProperty("cuentas");
    const vistas = await sr.from("auditoria").select("id").eq("accion", "vio_finanzas").eq("objeto_id", hogar);
    expect(vistas.data!.length).toBe(1);

    expect((await admin.rpc("responder_acceso_soporte", { p_id: acceso, p_accion: "revocar" })).error).toBeNull();
    expect((await soporte.rpc("consola_ver_finanzas", { p_hogar: hogar })).error?.message).toMatch(/No tienes permiso/);
  });
});

describe("Ley 1581", () => {
  let solicitud: string;

  it("el titular pide la supresión desde la app, con plazo de 15 días hábiles; no la duplica", async () => {
    const r = await sola.rpc("solicitar_privacidad", { p_tipo: "supresion", p_detalle: "Quiero cerrar mi cuenta" });
    expect(r.error).toBeNull();
    solicitud = r.data as string;
    const s = (await sola.from("solicitudes_privacidad").select("vence, recibida, estado").eq("id", solicitud).single()).data!;
    expect(s.recibida).toBe(hoyBogota());
    expect(s.vence).toBe(sumarHabiles(s.recibida, 15));
    expect((await sola.rpc("solicitar_privacidad", { p_tipo: "supresion", p_detalle: null })).error?.message).toMatch(/en trámite/);
    expect((await admin.from("solicitudes_privacidad").select("id").eq("id", solicitud)).data).toEqual([]);
  });

  it("solo quien ve la auditoría las atiende; una consulta por correo corre desde que se recibió", async () => {
    expect((await soporte.rpc("consola_solicitudes_privacidad")).error?.message).toMatch(/no tiene permiso/);
    const superadmin = await entorno.usuario("sop-super");
    const id = (await superadmin.db.auth.getUser()).data.user!.id;
    await sr.from("platform_staff").insert({ user_id: id, nombre: "Super S7", rol: "superadmin" });
    await conDosPasos(superadmin.db);

    const recibida = sumarHabiles(hoyBogota(), 0);
    const c = await superadmin.db.rpc("consola_registrar_solicitud", { p_tipo: "consulta", p_correo: "Alguien@Correo.co", p_nombre: "Alguien", p_detalle: "¿Qué datos tienen?", p_recibida: recibida });
    expect(c.error).toBeNull();
    const fila = (await sr.from("solicitudes_privacidad").select("vence, titular_correo").eq("id", c.data as string).single()).data!;
    expect(fila).toEqual({ vence: sumarHabiles(recibida, 10), titular_correo: "alguien@correo.co" });
    await sr.from("solicitudes_privacidad").delete().eq("id", c.data as string);

    const exp = await superadmin.db.rpc("consola_exportar_titular", { p_id: solicitud });
    expect(exp.error).toBeNull();
    expect((exp.data as { hogares: { nombre: string }[] }).hogares.map((h) => h.nombre)).toEqual(["Hogar de la titular"]);

    // Supresión: primero informa; al ejecutar borra el hogar propio (cascada) y deja constancia.
    const previa = (await superadmin.db.rpc("consola_supresion", { p_id: solicitud, p_ejecutar: false })).data as { borrar: string[] };
    expect(previa.borrar).toEqual([hogarSola]);
    const hecha = await superadmin.db.rpc("consola_supresion", { p_id: solicitud, p_ejecutar: true });
    expect(hecha.error).toBeNull();
    expect((await sr.from("households").select("id").eq("id", hogarSola)).data).toEqual([]);
    expect((await sr.from("solicitudes_privacidad").select("estado, suprimida_en").eq("id", solicitud).single()).data!.estado).toBe("resuelta");
    expect((await superadmin.db.rpc("consola_supresion", { p_id: solicitud, p_ejecutar: true })).error?.message).toMatch(/ya se ejecutó/);
    await sr.from("solicitudes_privacidad").delete().eq("id", solicitud);
  });

  it("en un hogar compartido se retira a la persona y el hogar no queda sin administrador", async () => {
    const r = await admin.rpc("solicitar_privacidad", { p_tipo: "supresion", p_detalle: null });
    const superadmin = await entorno.usuario("sop-super2");
    await sr.from("platform_staff").insert({ user_id: (await superadmin.db.auth.getUser()).data.user!.id, nombre: "Super 2", rol: "superadmin" });
    await conDosPasos(superadmin.db);
    const hecha = await superadmin.db.rpc("consola_supresion", { p_id: r.data as string, p_ejecutar: true });
    expect(hecha.error).toBeNull();
    expect((hecha.data as { compartidos: string[] }).compartidos).toEqual([hogar]);
    const miembros = (await sr.from("members").select("nombre, rol, user_id").eq("household_id", hogar)).data!;
    expect(miembros.find((m) => m.nombre === "Pareja")!.rol).toBe("admin");
    expect(miembros.find((m) => m.nombre === "Persona retirada")!.user_id).toBeNull();
    await sr.from("solicitudes_privacidad").delete().eq("id", r.data as string);
  });

  it("la purga de retención es solo del servidor", async () => {
    expect((await admin.rpc("purgar_retencion")).error).not.toBeNull();
    expect((await sr.rpc("purgar_retencion")).error).toBeNull();
  });
});
