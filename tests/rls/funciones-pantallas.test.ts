/**
 * Funciones del diseño «App» con lógica en la base: rol Familiar, invitación por celular, cuota de deuda como pago
 * fijo (con fin tras N cuotas), «Generar pagos del mes», pago fijo de tarjeta (transferencia), presupuesto de un mes
 * y TRM de solo lectura.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { entornoDePrueba } from "./utilidades";

const entorno = entornoDePrueba();
const sr = entorno.admin;
let admin: SupabaseClient, familiar: SupabaseClient, otro: SupabaseClient;
let hogar: string, banco: string, tarjeta: string, deudas: string, vivienda: string, salario: string;

const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
const finDeMes = (() => {
  const [a, m] = hoy.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
})();

beforeAll(async () => {
  const a = await entorno.usuario("pantallas-admin");
  const f = await entorno.usuario("pantallas-familiar");
  const o = await entorno.usuario("pantallas-otro");
  admin = a.db;
  familiar = f.db;
  otro = o.db;
  hogar = await entorno.hogar(admin, "Hogar pantallas");
  banco = (await admin.from("accounts").insert({ household_id: hogar, tipo: "banco", subtipo: "ahorros", nombre: "Ahorros" }).select("id").single()).data!.id;
  tarjeta = (await admin.from("accounts").insert({ household_id: hogar, tipo: "tarjeta", nombre: "Visa", dia_pago: 20 }).select("id").single()).data!.id;
  const cat = async (nombre: string) => (await admin.from("categories").select("id").eq("household_id", hogar).eq("nombre", nombre).is("padre_id", null).single()).data!.id;
  [deudas, vivienda, salario] = await Promise.all([cat("Deudas"), cat("Vivienda"), cat("Salario")]);
});

afterAll(() => entorno.limpiar());

describe("invitación por celular y rol Familiar", () => {
  it("se invita con celular (sin correo) y la acepta cualquiera con el enlace", async () => {
    const inv = await admin.from("invitations").insert({ household_id: hogar, telefono: "3001234567", rol: "familiar" }).select("token").single();
    expect(inv.error).toBeNull();
    const malo = await admin.from("invitations").insert({ household_id: hogar, rol: "familiar" });
    expect(malo.error).not.toBeNull(); // ni correo ni celular
    const { error } = await familiar.rpc("aceptar_invitacion", { p_token: inv.data!.token, p_nombre: "Abuela" });
    expect(error).toBeNull();
  });

  it("el Familiar ve el hogar y registra gastos, pero no ingresos ni cambia nada", async () => {
    expect((await familiar.from("accounts").select("id").eq("household_id", hogar)).data).toHaveLength(2);
    const gasto = await familiar.from("transactions").insert({ household_id: hogar, account_id: banco, fecha: hoy, monto: 12_000, tipo: "gasto", category_id: vivienda }).select("id").single();
    expect(gasto.error).toBeNull();
    const ingreso = await familiar.from("transactions").insert({ household_id: hogar, account_id: banco, fecha: hoy, monto: 1, tipo: "ingreso", category_id: salario });
    expect(ingreso.error).not.toBeNull();
    const cambio = await familiar.from("transactions").update({ monto: 1 }).eq("id", gasto.data!.id).select("id");
    expect(cambio.data).toEqual([]);
    const cuenta = await familiar.from("accounts").insert({ household_id: hogar, tipo: "efectivo", nombre: "X" });
    expect(cuenta.error).not.toBeNull();
    // Otro hogar no ve nada.
    expect((await otro.from("transactions").select("id").eq("household_id", hogar)).data).toEqual([]);
  });
});

describe("pagos fijos de deuda, tarjeta y del mes", () => {
  it("la cuota de una deuda se programa con debt_id y se detiene tras N cuotas", async () => {
    const deuda = (await admin.from("debts").insert({ household_id: hogar, nombre: "Crédito", monto: 300_000, cuota: 100_000, cuotas_total: 3 }).select("id").single()).data!.id;
    const regla = await admin
      .from("recurring_rules")
      .insert({ household_id: hogar, descripcion: "Cuota Crédito", monto: 100_000, tipo: "gasto", account_id: banco, category_id: deudas, frecuencia: "semanal", fecha_inicio: hoy, proxima_fecha: hoy, ocurrencias_max: 2, debt_id: deuda })
      .select("id")
      .single();
    expect(regla.error).toBeNull();
    await admin.rpc("generar_pagos_mes", { p_household: hogar });
    const movs = (await admin.from("transactions").select("debt_id, estado").eq("recurring_rule_id", regla.data!.id)).data!;
    expect(movs).toHaveLength(2);
    expect(movs.every((m) => m.debt_id === deuda && m.estado === "programado")).toBe(true);
    expect((await admin.from("recurring_rules").select("activa").eq("id", regla.data!.id).single()).data!.activa).toBe(false);
  });

  it("«Generar pagos del mes» programa hasta fin de mes; el Familiar no puede", async () => {
    const regla = (await admin
      .from("recurring_rules")
      .insert({ household_id: hogar, descripcion: "Mercado semanal", monto: 50_000, tipo: "gasto", account_id: banco, category_id: vivienda, frecuencia: "semanal", fecha_inicio: hoy, proxima_fecha: hoy })
      .select("id")
      .single()).data!.id;
    expect((await familiar.rpc("generar_pagos_mes", { p_household: hogar })).error).not.toBeNull();
    await admin.rpc("generar_pagos_mes", { p_household: hogar });
    const fechas = (await admin.from("transactions").select("fecha").eq("recurring_rule_id", regla)).data!.map((t) => t.fecha).sort();
    expect(fechas[0]).toBe(hoy);
    // Semanal desde hoy hasta fin de mes (o 7 días, si el mes termina antes): la siguiente ya quedaría por fuera.
    const sumar = (f: string, n: number) => new Date(Date.parse(`${f}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
    const hasta = finDeMes > sumar(hoy, 7) ? finDeMes : sumar(hoy, 7);
    expect(fechas.at(-1)! <= hasta).toBe(true);
    expect(sumar(fechas.at(-1)!, 7) > hasta).toBe(true);
  });

  it("pagar la tarjeta: pago fijo de transferencia, sin categoría", async () => {
    const malo = await admin.from("recurring_rules").insert({ household_id: hogar, descripcion: "Mal", monto: 1, tipo: "transferencia", account_id: banco, category_id: vivienda, cuenta_destino_id: tarjeta, frecuencia: "mensual", fecha_inicio: hoy, proxima_fecha: hoy });
    expect(malo.error).not.toBeNull();
    const regla = await admin
      .from("recurring_rules")
      .insert({ household_id: hogar, descripcion: "Pago Visa", monto: 400_000, tipo: "transferencia", account_id: banco, cuenta_destino_id: tarjeta, frecuencia: "mensual", fecha_inicio: hoy, proxima_fecha: hoy })
      .select("id")
      .single();
    expect(regla.error).toBeNull();
    await admin.rpc("generar_recurrentes_hogar", { p_household: hogar });
    const t = (await admin.from("transactions").select("tipo, cuenta_destino_id, category_id").eq("recurring_rule_id", regla.data!.id).single()).data!;
    expect(t).toEqual({ tipo: "transferencia", cuenta_destino_id: tarjeta, category_id: null });
  });
});

describe("presupuesto de un mes y TRM", () => {
  it("con `mes` el presupuesto queda como único; sin él vuelve a repetirse", async () => {
    const mes = `${hoy.slice(0, 7)}-01`;
    expect((await admin.rpc("guardar_presupuesto", { p_hogar: hogar, p_items: [{ category_id: vivienda, monto: 90_000, mes }] })).error).toBeNull();
    let p = (await admin.from("budgets_goals").select("periodo, mes, monto").eq("household_id", hogar).eq("tipo", "presupuesto").single()).data!;
    expect(p).toEqual({ periodo: "unico", mes, monto: 90_000 });
    await admin.rpc("guardar_presupuesto", { p_hogar: hogar, p_items: [{ category_id: vivienda, monto: 95_000 }] });
    p = (await admin.from("budgets_goals").select("periodo, mes, monto").eq("household_id", hogar).eq("tipo", "presupuesto").single()).data!;
    expect(p).toEqual({ periodo: "mensual", mes: null, monto: 95_000 });
  });

  it("la TRM la leen todos y solo la escribe el servidor", async () => {
    await sr.from("trm").upsert({ fecha: hoy, valor: 3874.52 });
    expect((await admin.from("trm").select("valor").eq("fecha", hoy).single()).data!.valor).toBe(3874.52);
    expect((await admin.from("trm").insert({ fecha: "2000-01-01", valor: 1 })).error).not.toBeNull();
  });
});
