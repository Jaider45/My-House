/**
 * Funciones SQL de docs/mejoras.md: guardar_presupuesto (todo o nada, con rol), reservar_uso_ia (cupo que nadie
 * puede saltarse) y correos_de_usuarios (solo service_role).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { entornoDePrueba } from "./utilidades";

const entorno = entornoDePrueba();
let admin: SupabaseClient, contador: SupabaseClient, ajeno: SupabaseClient;
let adminEmail: string;
let hogar: string, hogarAjeno: string;
let mercado: string, transporte: string, categoriaAjena: string;

async function presupuesto(db: SupabaseClient, h = hogar) {
  const { data, error } = await db.from("budgets_goals").select("category_id, monto").eq("household_id", h).eq("tipo", "presupuesto");
  if (error) throw error;
  return Object.fromEntries(data.map((f) => [f.category_id, f.monto]));
}

beforeAll(async () => {
  const a = await entorno.usuario("mejoras-admin");
  const c = await entorno.usuario("mejoras-contador");
  const x = await entorno.usuario("mejoras-ajeno");
  admin = a.db; contador = c.db; ajeno = x.db; adminEmail = a.email;
  hogar = await entorno.hogar(admin, "Hogar mejoras");
  hogarAjeno = await entorno.hogar(ajeno, "Hogar ajeno");

  const inv = await admin.from("invitations").insert({ household_id: hogar, email: c.email, rol: "contador" }).select("token").single();
  if (inv.error) throw inv.error;
  const acepta = await contador.rpc("aceptar_invitacion", { p_token: inv.data.token, p_nombre: "Contadora" });
  if (acepta.error) throw acepta.error;

  mercado = (await admin.from("categories").select("id").eq("nombre", "Mercado").single()).data!.id;
  transporte = (await admin.from("categories").select("id").eq("nombre", "Transporte").single()).data!.id;
  categoriaAjena = (await ajeno.from("categories").select("id").eq("nombre", "Mercado").single()).data!.id;
});

afterAll(() => entorno.limpiar());

describe("guardar_presupuesto", () => {
  it("crea, actualiza y borra (monto 0) en una sola llamada", async () => {
    let r = await admin.rpc("guardar_presupuesto", { p_hogar: hogar, p_items: [{ category_id: mercado, monto: 800_000 }, { category_id: transporte, monto: 200_000 }] });
    expect(r.error).toBeNull();
    expect(await presupuesto(admin)).toEqual({ [mercado]: 800_000, [transporte]: 200_000 });

    r = await admin.rpc("guardar_presupuesto", { p_hogar: hogar, p_items: [{ category_id: mercado, monto: 950_000 }, { category_id: transporte, monto: 0 }] });
    expect(r.error).toBeNull();
    expect(await presupuesto(admin)).toEqual({ [mercado]: 950_000 });
  });

  it("es todo o nada: una categoría de otro hogar revierte también las válidas", async () => {
    const r = await admin.rpc("guardar_presupuesto", {
      p_hogar: hogar,
      p_items: [{ category_id: transporte, monto: 300_000 }, { category_id: categoriaAjena, monto: 1 }],
    });
    expect(r.error).not.toBeNull();
    expect(await presupuesto(admin)).toEqual({ [mercado]: 950_000 });
    expect(await presupuesto(ajeno, hogarAjeno)).toEqual({});
  });

  it("rechaza montos negativos o ids vacíos", async () => {
    for (const items of [[{ category_id: mercado, monto: -5 }], [{ category_id: null, monto: 5 }], { no: "es arreglo" }]) {
      const r = await admin.rpc("guardar_presupuesto", { p_hogar: hogar, p_items: items });
      expect(r.error?.message).toMatch(/inválidos/);
    }
    expect(await presupuesto(admin)).toEqual({ [mercado]: 950_000 });
  });

  it("el contador y otro hogar reciben un error (no 0 filas en silencio)", async () => {
    for (const db of [contador, ajeno]) {
      const r = await db.rpc("guardar_presupuesto", { p_hogar: hogar, p_items: [{ category_id: mercado, monto: 1 }] });
      expect(r.error?.message).toBe("Tu rol es de solo lectura.");
    }
    expect(await presupuesto(admin)).toEqual({ [mercado]: 950_000 });
  });
});

describe("reservar_uso_ia", () => {
  it("registra cada uso y corta al pasar el tope por hora", async () => {
    for (let i = 0; i < 3; i++) {
      const r = await admin.rpc("reservar_uso_ia", { p_hogar: hogar, p_tipo: "comprobante", p_cantidad: 10 });
      expect(r.error).toBeNull();
    }
    const lleno = await admin.rpc("reservar_uso_ia", { p_hogar: hogar, p_tipo: "extracto" });
    expect(lleno.error?.message).toMatch(/límite de 30 lecturas con IA por hora/);
    const { count } = await admin.from("ia_usos").select("*", { count: "exact", head: true }).eq("household_id", hogar);
    expect(count).toBe(30);
  });

  it("nadie puede escribir ni borrar sus usos para recargar el cupo", async () => {
    const borrar = await admin.from("ia_usos").delete().eq("household_id", hogar).select("id");
    expect(borrar.data ?? []).toHaveLength(0);
    const insertar = await admin.from("ia_usos").insert({ household_id: hogar, tipo: "comprobante" });
    expect(insertar.error).not.toBeNull();
    const { count } = await admin.from("ia_usos").select("*", { count: "exact", head: true }).eq("household_id", hogar);
    expect(count).toBe(30);
  });

  it("el contador no puede gastar cupo y otro hogar no ve los usos", async () => {
    const r = await contador.rpc("reservar_uso_ia", { p_hogar: hogar, p_tipo: "comprobante" });
    expect(r.error?.message).toBe("Tu rol es de solo lectura.");
    const { data } = await ajeno.from("ia_usos").select("id").eq("household_id", hogar);
    expect(data).toEqual([]);
  });

  it("rechaza cantidades fuera de rango y tipos desconocidos", async () => {
    expect((await ajeno.rpc("reservar_uso_ia", { p_hogar: hogarAjeno, p_tipo: "comprobante", p_cantidad: 50 })).error).not.toBeNull();
    expect((await ajeno.rpc("reservar_uso_ia", { p_hogar: hogarAjeno, p_tipo: "otro" })).error).not.toBeNull();
  });
});

describe("correos_de_usuarios", () => {
  it("solo la llave de servicio puede leer correos", async () => {
    const { data: yo } = await admin.auth.getUser();
    const r = await admin.rpc("correos_de_usuarios", { p_ids: [yo.user!.id] });
    expect(r.error).not.toBeNull();
    const s = await entorno.admin.rpc("correos_de_usuarios", { p_ids: [yo.user!.id] });
    expect(s.error).toBeNull();
    expect(s.data).toEqual([{ id: yo.user!.id, email: adminEmail }]);
  });
});
