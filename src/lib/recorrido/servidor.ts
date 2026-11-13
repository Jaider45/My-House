import "server-only";
import { cache } from "react";
import { obtenerContexto, obtenerUsuario } from "@/lib/sesion";
import { evaluarRecorrido, leerPreferencias, type Recorrido } from ".";

/**
 * Estado del recorrido para quien está en su hogar activo. null = no aplica (rol de solo lectura u hogar
 * suspendido). Si la persona lo ocultó no se consulta la base: las preferencias viajan en el JWT.
 * Una vez por request (`cache`): lo usan la barra del layout y la página del recorrido.
 */
export const cargarRecorrido = cache(async (aunqueOculto = false): Promise<Recorrido | null> => {
  const [ctx, { user, hogar, mfaActiva }] = await Promise.all([obtenerContexto(), obtenerUsuario()]);
  if (!ctx.puedeEditar || hogar?.suspendido) return null;
  const pref = leerPreferencias(user.user_metadata, ctx.hogar.id);
  if (pref.oculto && !aunqueOculto) return evaluarRecorrido(SIN_DATOS, pref);

  const h = ctx.hogar.id;
  const contar = { count: "exact", head: true } as const;
  // Quien pertenece a varios hogares ve por RLS las filas de todos: se filtra siempre por el hogar activo.
  const [cuentas, ingresos, pagos, presupuestos, movimientos, personas, invitaciones, dosPasos] = await Promise.all([
    ctx.supabase.from("accounts").select("id", contar).eq("household_id", h).eq("archivada", false),
    ctx.supabase.from("recurring_rules").select("id", contar).eq("household_id", h).eq("tipo", "ingreso").eq("activa", true),
    ctx.supabase.from("recurring_rules").select("id", contar).eq("household_id", h).eq("tipo", "gasto").eq("activa", true),
    ctx.supabase.from("budgets_goals").select("id", contar).eq("household_id", h).eq("tipo", "presupuesto"),
    ctx.supabase.from("transactions").select("id", contar).eq("household_id", h).neq("origen", "recurrente"),
    ctx.supabase.from("members").select("id", contar).eq("household_id", h),
    ctx.supabase.from("invitations").select("id", contar).eq("household_id", h),
    typeof mfaActiva === "boolean" ? mfaActiva : tieneDosPasos(ctx.supabase),
  ]);

  return evaluarRecorrido(
    {
      cuentas: cuentas.count ?? 0,
      ingresosFijos: ingresos.count ?? 0,
      pagosFijos: pagos.count ?? 0,
      presupuestos: presupuestos.count ?? 0,
      movimientos: movimientos.count ?? 0,
      personas: personas.count ?? 1,
      invitaciones: invitaciones.count ?? 0,
      dosPasos,
    },
    pref,
  );
});

const SIN_DATOS = { cuentas: 0, ingresosFijos: 0, pagosFijos: 0, presupuestos: 0, movimientos: 0, personas: 1, invitaciones: 0, dosPasos: false };

/** Solo para tokens anteriores al claim `mfa_activa`. */
async function tieneDosPasos(supabase: Awaited<ReturnType<typeof obtenerContexto>>["supabase"]): Promise<boolean> {
  const { data } = await supabase.auth.mfa.listFactors();
  return (data?.totp ?? []).some((f) => f.status === "verified");
}
