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
export async function cargarSemaforo(ctx: Ctx, anio: number): Promise<SemaforoAnio> {
  const j = jurisdiccion(ctx.hogar.pais);
  if (!j) return { ok: false, motivo: `Aún no hay módulo tributario para ${ctx.hogar.pais}.` };

  const [{ data: params }, { data: acumulados, error }] = await Promise.all([
    ctx.supabase.from("tax_params").select("anio, uvt_valor, topes").eq("pais", ctx.hogar.pais).eq("anio", anio).maybeSingle(),
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

export const COLOR_SEMAFORO: Record<Semaforo, { punto: string; barra: string; texto: string }> = {
  verde: { punto: "bg-emerald-500", barra: "bg-emerald-500", texto: "Lejos del tope" },
  amarillo: { punto: "bg-amber-500", barra: "bg-amber-500", texto: "Cerca del tope (70 % o más)" },
  rojo: { punto: "bg-red-600", barra: "bg-red-600", texto: "Alcanzó el tope: debe declarar" },
};
