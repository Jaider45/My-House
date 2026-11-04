/**
 * Generación de recurrentes en Postgres: fechas iguales a la versión TS (fin de mes incluido)
 * e idempotencia (correr dos veces no duplica).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fechaOcurrencia } from "@/lib/recurrentes";
import { hoy, mesDe, rangoMes, sumarDias, sumarMeses } from "@/lib/fechas";
import { entornoDePrueba } from "./utilidades";

const entorno = entornoDePrueba();
let db: SupabaseClient;
let hogar: string;
let cuenta: string;
let categoria: string;

beforeAll(async () => {
  ({ db } = await entorno.usuario("recurrente"));
  hogar = await entorno.hogar(db, "Hogar recurrente");
  cuenta = (await db.from("accounts").insert({ household_id: hogar, tipo: "banco", nombre: "Banco" }).select("id").single()).data!.id;
  categoria = (await db.from("categories").select("id").eq("nombre", "Vivienda").single()).data!.id;
});

afterAll(() => entorno.limpiar());

describe("generar_recurrentes_hogar", () => {
  it("genera las ocurrencias pendientes con fechas de fin de mes correctas y no duplica", async () => {
    // Regla mensual que arrancó un día 31 hace unos meses: cruza meses de 30 días (y quizá febrero).
    let k = 3;
    while (!rangoMes(sumarMeses(mesDe(hoy()), -k)).hasta.endsWith("-31")) k++;
    const inicio31 = rangoMes(sumarMeses(mesDe(hoy()), -k)).hasta;
    const { data: regla, error } = await db
      .from("recurring_rules")
      .insert({
        household_id: hogar, descripcion: "Arriendo", monto: 1_800_000, account_id: cuenta, category_id: categoria,
        frecuencia: "mensual", fecha_inicio: inicio31, proxima_fecha: inicio31,
      })
      .select("id")
      .single();
    expect(error).toBeNull();

    const limite = sumarDias(hoy(), 7);
    const esperadas: string[] = [];
    for (let n = 0; fechaOcurrencia(inicio31, "mensual", n) <= limite; n++) esperadas.push(fechaOcurrencia(inicio31, "mensual", n));

    const primera = await db.rpc("generar_recurrentes_hogar", { p_household: hogar });
    expect(primera.error).toBeNull();
    expect(primera.data).toBe(esperadas.length);

    const { data: movs } = await db
      .from("transactions")
      .select("fecha, monto, estado, origen")
      .eq("recurring_rule_id", regla!.id)
      .order("fecha");
    expect(movs!.map((m) => m.fecha)).toEqual(esperadas);
    expect(movs!.every((m) => m.estado === "programado" && m.origen === "recurrente" && m.monto === 1_800_000)).toBe(true);

    const { data: actualizada } = await db.from("recurring_rules").select("proxima_fecha, ocurrencias").eq("id", regla!.id).single();
    expect(actualizada).toEqual({ proxima_fecha: fechaOcurrencia(inicio31, "mensual", esperadas.length), ocurrencias: esperadas.length });

    const segunda = await db.rpc("generar_recurrentes_hogar", { p_household: hogar });
    expect(segunda.data).toBe(0);
  });

  it("no genera reglas pausadas", async () => {
    const { error } = await db.from("recurring_rules").insert({
      household_id: hogar, descripcion: "Pausada", monto: 1000, account_id: cuenta, category_id: categoria,
      frecuencia: "semanal", fecha_inicio: hoy(), proxima_fecha: hoy(), activa: false,
    });
    expect(error).toBeNull();
    const { data } = await db.rpc("generar_recurrentes_hogar", { p_household: hogar });
    expect(data).toBe(0);
  });
});
