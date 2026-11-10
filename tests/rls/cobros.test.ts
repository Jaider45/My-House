/**
 * Cobros (roadmap SaaS S3): el hogar crea su cobro; solo el webhook (service_role) lo da por pagado, una vez por
 * evento y con el monto exacto; el cron renueva, cobra la mora y baja a Gratis al día 14; cupones y reembolsos.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conDosPasos, entornoDePrueba } from "./utilidades";

const entorno = entornoDePrueba();
const sr = entorno.admin;
let admin: SupabaseClient, editor: SupabaseClient, finanzas: SupabaseClient, otro: SupabaseClient;
let hogar: string, hogarOtro: string;
const sufijo = Math.random().toString(36).slice(2, 7).toUpperCase();
const CUPON = `BETA50${sufijo}`;
const GRATIS1 = `MES1${sufijo}`;

const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
const dia = (base: string, n: number) => {
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const masUnMes = (f: string) => {
  const [a, m, d] = f.split("-").map(Number);
  const x = new Date(Date.UTC(a, m, 1));
  const ultimo = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(d, ultimo)).padStart(2, "0")}`;
};

let evento = 0;
async function webhook(referencia: string, estado: string, montoCentavos: number, id = `evt-${sufijo}-${++evento}`) {
  const r = await sr.rpc("registrar_pago_wompi", {
    p_evento: id, p_referencia: referencia, p_transaccion: `tx-${id}`, p_estado: estado,
    p_monto_centavos: montoCentavos, p_metodo: "CARD", p_detalle: "VISA ···4242", p_payload: { prueba: true },
  });
  if (r.error) throw r.error;
  return r.data as { resultado: string };
}
const suscripcion = async (h = hogar) => (await sr.from("suscripciones").select("*").eq("household_id", h).single()).data!;
const plan = async (h = hogar) => (await sr.from("households").select("plan").eq("id", h).single()).data!.plan;

beforeAll(async () => {
  const a = await entorno.usuario("cobros-admin");
  const e = await entorno.usuario("cobros-editor");
  const f = await entorno.usuario("cobros-finanzas");
  const o = await entorno.usuario("cobros-otro");
  admin = a.db; editor = e.db; finanzas = f.db; otro = o.db;
  hogar = await entorno.hogar(admin, "Hogar cobros", "gratis");
  hogarOtro = await entorno.hogar(otro, "Hogar cupón", "gratis");
  const inv = await admin.from("invitations").insert({ household_id: hogar, email: e.email, rol: "editor" }).select("token").single();
  await editor.rpc("aceptar_invitacion", { p_token: inv.data!.token, p_nombre: "Editora" });

  const fid = (await finanzas.auth.getUser()).data.user!.id;
  await sr.from("platform_staff").insert({ user_id: fid, nombre: "Finanzas cobros", rol: "finanzas" });
  await conDosPasos(finanzas);
  const c1 = await finanzas.rpc("consola_guardar_cupon", {
    p_codigo: CUPON.toLowerCase(), p_descripcion: "50 % por 3 meses", p_tipo: "porcentaje", p_valor: 50, p_periodos: 3,
    p_planes: ["familia"], p_periodo: "mensual", p_usos_max: 200, p_desde: null, p_hasta: null, p_activo: true,
  });
  if (c1.error) throw c1.error;
  const c2 = await finanzas.rpc("consola_guardar_cupon", {
    p_codigo: GRATIS1, p_descripcion: "1 mes gratis", p_tipo: "meses_gratis", p_valor: 1, p_periodos: null,
    p_planes: ["familia"], p_periodo: null, p_usos_max: null, p_desde: null, p_hasta: null, p_activo: true,
  });
  if (c2.error) throw c2.error;
});

afterAll(async () => {
  await sr.from("cupones").delete().in("codigo", [CUPON, GRATIS1]);
  await entorno.limpiar();
});

describe("cotizar y crear el cobro", () => {
  it("precio del plan y cupón", async () => {
    const q = await admin.rpc("cotizar_plan", { p_hogar: hogar, p_plan: "familia", p_periodo: "mensual" });
    expect(q.data).toMatchObject({ precio: 19_900, descuento: 0, monto: 19_900 });
    const c = await admin.rpc("cotizar_plan", { p_hogar: hogar, p_plan: "familia", p_periodo: "mensual", p_cupon: CUPON.toLowerCase() });
    expect(c.data).toMatchObject({ descuento: 9_950, monto: 9_950, cupon: CUPON });
    const anual = await admin.rpc("cotizar_plan", { p_hogar: hogar, p_plan: "familia", p_periodo: "anual", p_cupon: CUPON });
    expect(anual.error?.message).toMatch(/solo aplica al pago mensual/);
    expect((await admin.rpc("cotizar_plan", { p_hogar: hogar, p_plan: "familia", p_periodo: "mensual", p_cupon: "NOEXISTE" })).error?.message).toMatch(/no existe/);
  });

  it("solo el admin crea cobros y ve el historial", async () => {
    expect((await editor.rpc("crear_cobro", { p_hogar: hogar, p_plan: "familia", p_periodo: "mensual" })).error?.message).toMatch(/Solo un administrador/);
    expect((await admin.rpc("crear_cobro", { p_hogar: hogar, p_plan: "gratis", p_periodo: "mensual" })).error?.message).toMatch(/no está disponible/);
    const r = await admin.rpc("crear_cobro", { p_hogar: hogar, p_plan: "familia", p_periodo: "mensual", p_cupon: CUPON });
    expect(r.error).toBeNull();
    expect(r.data).toMatchObject({ monto: 9_950, activado: false });
    expect((await admin.from("cobros").select("id").eq("household_id", hogar)).data).toHaveLength(1);
    expect((await editor.from("cobros").select("id").eq("household_id", hogar)).data).toEqual([]);
  });

  it("nadie fuera del servidor confirma un pago", async () => {
    const r = await admin.rpc("registrar_pago_wompi", {
      p_evento: "x", p_referencia: "x", p_transaccion: "x", p_estado: "APPROVED", p_monto_centavos: 1, p_metodo: "x", p_detalle: "x", p_payload: {},
    });
    expect(r.error).not.toBeNull();
  });
});

describe("webhook de Wompi", () => {
  it("un monto distinto no activa el plan", async () => {
    const { data } = await admin.rpc("cobro_pendiente", { p_hogar: hogar });
    const ref = (data as { referencia: string }).referencia;
    expect((await webhook(ref, "APPROVED", 100)).resultado).toBe("monto_distinto");
    expect(await plan()).toBe("gratis");
  });

  it("pago aprobado: activa Familia un mes, una sola vez por evento", async () => {
    const nuevo = await admin.rpc("crear_cobro", { p_hogar: hogar, p_plan: "familia", p_periodo: "mensual", p_cupon: CUPON });
    const ref = (nuevo.data as { referencia: string }).referencia;
    expect((await webhook(ref, "PENDING", 995_000)).resultado).toBe("pendiente");
    const id = `evt-${sufijo}-aprobado`;
    expect((await webhook(ref, "APPROVED", 995_000, id)).resultado).toBe("aplicado");
    expect((await webhook(ref, "APPROVED", 995_000, id)).resultado).toBe("duplicado");
    expect(await plan()).toBe("familia");
    const s = await suscripcion();
    expect(s).toMatchObject({ plan: "familia", periodo: "mensual", estado: "activa", desde: hoy, vence: masUnMes(hoy), cupon: CUPON, cupon_periodos_restantes: 2 });
  });
});

describe("renovación, mora y baja a Gratis", () => {
  it("3 días antes crea el cobro de renovación (con el descuento que queda) una sola vez", async () => {
    await sr.from("suscripciones").update({ vence: dia(hoy, 3) }).eq("household_id", hogar);
    const r = await sr.rpc("procesar_vencimientos", { p_hoy: hoy });
    const mios = (r.data as { hogar: string; tipo: string; monto: number }[]).filter((a) => a.hogar === hogar);
    expect(mios).toEqual([expect.objectContaining({ tipo: "renovacion", monto: 9_950 })]);
    const otraVez = await sr.rpc("procesar_vencimientos", { p_hoy: hoy });
    expect((otraVez.data as { hogar: string }[]).filter((a) => a.hogar === hogar)).toEqual([]);
  });

  it("día 1 de mora: aviso y estado vencida; pagar en mora conserva el ciclo", async () => {
    const vence = dia(hoy, 3);
    const r = await sr.rpc("procesar_vencimientos", { p_hoy: dia(vence, 1) });
    expect((r.data as { hogar: string; tipo: string; dia?: number }[]).filter((a) => a.hogar === hogar)).toEqual([
      expect.objectContaining({ tipo: "mora", dia: 1, monto: 9_950 }),
    ]);
    expect((await suscripcion()).estado).toBe("vencida");

    const { data } = await admin.rpc("cobro_pendiente", { p_hogar: hogar });
    const ref = (data as { referencia: string; motivo: string }).referencia;
    expect((data as { motivo: string }).motivo).toBe("renovacion");
    expect((await webhook(ref, "APPROVED", 995_000)).resultado).toBe("aplicado");
    const s = await suscripcion();
    expect(s).toMatchObject({ estado: "activa", vence: masUnMes(vence), cupon_periodos_restantes: 1 });
  });

  it("día 14 sin pagar: pasa a Gratis y anula lo pendiente", async () => {
    const vence = (await suscripcion()).vence as string;
    const r = await sr.rpc("procesar_vencimientos", { p_hoy: dia(vence, 14) });
    const tipos = (r.data as { hogar: string; tipo: string }[]).filter((a) => a.hogar === hogar).map((a) => a.tipo);
    expect(tipos).toContain("gratis");
    expect(await plan()).toBe("gratis");
    expect((await suscripcion()).estado).toBe("cancelada");
    expect((await sr.from("cobros").select("id").eq("household_id", hogar).eq("estado", "pendiente")).data).toEqual([]);
  });
});

describe("cupón de meses gratis, cancelación y reembolso", () => {
  it("1 mes gratis activa el plan sin pasar por Wompi; el cupón se usa una vez por hogar", async () => {
    const r = await otro.rpc("crear_cobro", { p_hogar: hogarOtro, p_plan: "familia", p_periodo: "mensual", p_cupon: GRATIS1 });
    expect(r.data).toMatchObject({ monto: 0, activado: true });
    expect(await plan(hogarOtro)).toBe("familia");
    expect((await otro.rpc("cotizar_plan", { p_hogar: hogarOtro, p_plan: "familia", p_periodo: "mensual", p_cupon: GRATIS1 })).error?.message).toMatch(/ya usó/);
  });

  it("cancelar al vencer: pasa a Gratis sin mora", async () => {
    expect((await otro.rpc("cancelar_al_vencer", { p_hogar: hogarOtro, p_cancelar: true })).error).toBeNull();
    const vence = (await suscripcion(hogarOtro)).vence as string;
    const r = await sr.rpc("procesar_vencimientos", { p_hoy: vence });
    expect((r.data as { hogar: string; tipo: string }[]).filter((a) => a.hogar === hogarOtro).map((a) => a.tipo)).toEqual(["cancelada"]);
    expect(await plan(hogarOtro)).toBe("gratis");
  });

  it("finanzas registra un reembolso y ve el resumen", async () => {
    const pagado = (await sr.from("cobros").select("id").eq("household_id", hogar).eq("estado", "pagado").limit(1).single()).data!;
    expect((await finanzas.rpc("consola_marcar_reembolso", { p_cobro: pagado.id, p_motivo: "Cobro duplicado", p_bajar_plan: false })).error).toBeNull();
    expect((await finanzas.rpc("consola_marcar_reembolso", { p_cobro: pagado.id, p_motivo: "Otra vez", p_bajar_plan: false })).error?.message).toMatch(/Solo se reembolsa/);
    const res = await finanzas.rpc("consola_cobros_resumen");
    expect(res.error).toBeNull();
    expect(res.data).toHaveProperty("mrr");
    const lista = await finanzas.rpc("consola_cobros", { p_estado: "reembolsado" });
    expect(lista.data!.some((c: { id: string }) => c.id === pagado.id)).toBe(true);
  });
});
