import "server-only";
import { cache } from "react";
import { obtenerContexto } from "@/lib/sesion";
import type { EstadoPlan, Limites, Plan } from ".";

/**
 * Plan del hogar activo, su uso y los planes publicados para hogares (una vez por request). Tres consultas en
 * paralelo; no se cachea entre requests (decisión: datos del hogar frescos).
 */
export const cargarMiPlan = cache(async () => {
  const ctx = await obtenerContexto();
  const [estado, planes, config] = await Promise.all([
    ctx.supabase.rpc("mi_plan", { p_hogar: ctx.hogar.id }),
    ctx.supabase.from("planes").select("*").eq("para", "hogar").order("orden"),
    ctx.supabase.from("plataforma_config").select("clave, valor"),
  ]);
  if (estado.error) throw estado.error;
  const lista = (planes.data ?? []) as Plan[];
  const e = estado.data as EstadoPlan;
  const reglas = Object.fromEntries((config.data ?? []).map((c) => [c.clave, c.valor])) as Record<string, unknown>;
  const actual = lista.find((p) => p.codigo === e.efectivo);
  return {
    ctx,
    estado: e,
    planes: lista,
    actual,
    limites: (actual?.limites ?? {}) as Limites,
    pruebaDias: Number(reglas.prueba_dias ?? 14),
    descuentoAnualVisible: reglas.descuento_anual_visible !== false,
  };
});

/**
 * Límites del plan efectivo (con la prueba de Familia), sin el uso: lo liviano para decidir qué mostrar en Metas o
 * Presupuesto. Dos consultas pequeñas en paralelo.
 */
export const limitesHogar = cache(async (): Promise<Limites> => {
  const ctx = await obtenerContexto();
  const [{ data: hogar }, { data: planes }] = await Promise.all([
    ctx.supabase.from("households").select("plan, prueba_hasta").eq("id", ctx.hogar.id).single(),
    ctx.supabase.from("planes").select("codigo, limites"),
  ]);
  const enPrueba = hogar?.plan === "gratis" && hogar.prueba_hasta && new Date(hogar.prueba_hasta) > new Date();
  const codigo = enPrueba ? "familia" : (hogar?.plan ?? "gratis");
  return ((planes ?? []).find((p) => p.codigo === codigo)?.limites ?? {}) as Limites;
});

/** ¿El plan del hogar incluye la función? (metas, renta_reporte, whatsapp). */
export async function tieneFuncion(clave: "metas" | "renta_reporte" | "whatsapp"): Promise<boolean> {
  return (await limitesHogar())[clave] === true;
}
