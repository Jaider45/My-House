"use server";

import { revalidatePath } from "next/cache";
import { mensajeError, type Estado } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { consultarTransaccion, obtenerWompi, procesarTransaccion } from "@/lib/pagos/servidor";
import { crearClienteServicio, hayServicio } from "@/lib/supabase/servicio";

/**
 * «Conciliar»: pregunta a Wompi el estado real de los cobros pendientes o fallidos con transacción (30 días) y lo
 * registra como lo haría el webhook (idempotente). Sirve si un webhook no llegó.
 */
export async function conciliar(): Promise<Estado> {
  const staff = await obtenerStaff();
  if (!staff.puede("cobros")) return { error: "Solo Finanzas o un superadmin concilian cobros." };
  const wompi = await obtenerWompi();
  if (!wompi) return { error: "Wompi no está conectado." };
  if (!hayServicio()) return { error: "Falta la llave de servicio en el servidor." };
  const { data, error } = await staff.supabase.rpc("consola_cobros_por_conciliar");
  if (error) return { error: mensajeError(error) };
  const db = crearClienteServicio();
  let revisados = 0;
  let cambiaron = 0;
  for (const c of data ?? []) {
    const t = await consultarTransaccion(c.transaccion_id, wompi.publica);
    if (!t) continue;
    revisados++;
    const r = await procesarTransaccion(db, t, { conciliado_por: staff.nombre, data: { transaction: t } });
    if (!("error" in r) && r.resultado === "aplicado") cambiaron++;
  }
  revalidatePath("/consola/cobros");
  return { ok: revisados ? `Revisamos ${revisados} ${revisados === 1 ? "cobro" : "cobros"} con Wompi: ${cambiaron} ${cambiaron === 1 ? "quedó pagado" : "quedaron pagados"}.` : "No hay cobros pendientes con transacción para revisar." };
}
