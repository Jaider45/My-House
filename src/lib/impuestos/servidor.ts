import "server-only";
import type { obtenerContexto } from "@/lib/sesion";
import { jurisdiccion, peorSemaforo } from "./registro";
import type { Acumulados, JurisdiccionTributaria, ParametrosAnio, ResultadoTope, Semaforo } from "./tipos";

export type SemaforoPersona = { member_id: string; nombre: string; topes: ResultadoTope[]; estado: Semaforo };
export type SemaforoAnio =
  | { ok: true; anio: number; jurisdiccion: JurisdiccionTributaria; params: ParametrosAnio; personas: SemaforoPersona[] }
  | { ok: false; motivo: string };

type Ctx = Awaited<ReturnType<typeof obtenerContexto>>;

/** Acumulado del año de cada persona del hogar contra los topes para declarar del país del hogar. */
export async function cargarSemaforo(ctx: Ctx, anio: number, parametros?: ParametrosAnio | null): Promise<SemaforoAnio> {
  const j = jurisdiccion(ctx.hogar.pais);
  if (!j) return { ok: false, motivo: `Aún no hay módulo tributario para ${ctx.hogar.pais}.` };

  // `parametros` evita releer tax_params por cada hogar cuando se calculan varios (panel del contador).
  const [{ data: params }, { data: acumulados, error }] = await Promise.all([
    parametros !== undefined
      ? Promise.resolve({ data: parametros })
      : ctx.supabase.from("tax_params").select("anio, uvt_valor, topes, deducciones").eq("pais", ctx.hogar.pais).eq("anio", anio).eq("publicado", true).maybeSingle(),
    ctx.supabase.rpc("acumulados_tributarios", { p_household: ctx.hogar.id, p_anio: anio }),
  ]);
  if (!params) return { ok: false, motivo: `No hay valor de ${j.unidad} cargado para ${anio}.` };
  if (error) return { ok: false, motivo: error.message };

  const p = params as ParametrosAnio;
  const personas = ((acumulados ?? []) as Acumulados[]).map((a) => {
    const topes = j.evaluarTopes(p, a);
    return { member_id: a.member_id, nombre: a.nombre, topes, estado: peorSemaforo(topes) };
  });
  return { ok: true, anio, jurisdiccion: j, params: p, personas };
}

/** Parámetros tributarios de un país y año, para reusarlos entre varios hogares. */
export async function cargarParametros(ctx: Ctx, pais: string, anio: number): Promise<ParametrosAnio | null> {
  const { data } = await ctx.supabase.from("tax_params").select("anio, uvt_valor, topes, deducciones").eq("pais", pais).eq("anio", anio).eq("publicado", true).maybeSingle();
  return (data as ParametrosAnio | null) ?? null;
}

/** Presentación del semáforo: tono de chip, color del medidor (hex, va en SVG) y textos. */
export const COLOR_SEMAFORO: Record<Semaforo, { tono: "ok" | "alerta" | "error"; color: string; etiqueta: string; texto: string }> = {
  verde: { tono: "ok", color: "#1f7a55", etiqueta: "Bajo el tope", texto: "Lejos del tope" },
  amarillo: { tono: "alerta", color: "#d9a21b", etiqueta: "Cerca", texto: "Cerca del tope (70 % o más)" },
  rojo: { tono: "error", color: "#c2431f", etiqueta: "Obligado", texto: "Alcanzó el tope: debe declarar" },
};
