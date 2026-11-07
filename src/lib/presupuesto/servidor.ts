import "server-only";
import type { obtenerContexto } from "@/lib/sesion";
import { rangoMes } from "@/lib/fechas";
import type { PlanMes } from "@/lib/finanzas";
import { armarPlan } from ".";

type Ctx = Awaited<ReturnType<typeof obtenerContexto>>;

export type ReglaActiva = {
  id: string;
  descripcion: string;
  monto: number;
  tipo: "gasto" | "ingreso" | "transferencia";
  account_id: string;
  category_id: string;
  frecuencia: Parameters<typeof armarPlan>[0]["reglas"][number]["frecuencia"];
  fecha_inicio: string;
  ocurrencias: number;
};

/** Pagos fijos activos + gasto variable presupuestado, y el plan del mes que sale de ellos. */
export async function cargarPlan(ctx: Ctx, mes: string, hoy: string): Promise<{ plan: PlanMes; reglas: ReglaActiva[]; presupuestos: { category_id: string; monto: number }[] }> {
  const [{ data: reglas }, { data: presupuestos }] = await Promise.all([
    ctx.supabase
      .from("recurring_rules")
      .select("id, descripcion, monto, tipo, account_id, category_id, frecuencia, fecha_inicio, ocurrencias")
      .eq("activa", true)
      .order("monto", { ascending: false }),
    ctx.supabase.from("budgets_goals").select("category_id, monto").eq("tipo", "presupuesto"),
  ]);
  const lista = (reglas ?? []) as ReglaActiva[];
  const montos = (presupuestos ?? []).filter((p): p is { category_id: string; monto: number } => !!p.category_id);
  return { plan: armarPlan({ mes, hoy, hasta: rangoMes(mes).hasta, reglas: lista, presupuestos: montos }), reglas: lista, presupuestos: montos };
}
