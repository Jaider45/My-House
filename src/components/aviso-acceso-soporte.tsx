import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import { obtenerContexto } from "@/lib/sesion";
import { formatearMomento } from "@/lib/consola/formato";
import { responderAcceso } from "@/app/(app)/ayuda/acciones";

/**
 * Al administrador: soporte pide ver los datos financieros del hogar (aprobar o rechazar) o ya tiene acceso (revocar).
 * Nadie del equipo los ve sin esto (decisión 4.5 del roadmap SaaS).
 */
export async function AvisoAccesoSoporte() {
  const ctx = await obtenerContexto();
  if (!ctx.esAdmin) return null;
  const { data } = await ctx.supabase
    .from("accesos_soporte")
    .select("id, staff_nombre, motivo, horas, estado, vence")
    .eq("household_id", ctx.hogar.id)
    .or(`estado.eq.pedido,and(estado.eq.aprobado,vence.gt.${new Date().toISOString()})`)
    .order("pedido_en", { ascending: false })
    .limit(3);
  if (!data?.length) return null;
  return (
    <div className="mb-4 flex flex-col gap-2">
      {data.map((a) => (
        <section key={a.id} aria-label="Acceso de soporte" className="flex flex-wrap items-center gap-3 rounded-2xl bg-alerta-fondo px-4 py-3 text-alerta-tinta">
          <p className="min-w-0 flex-1 text-sm">
            {a.estado === "pedido" ? (
              <>
                <b>{a.staff_nombre}</b>, de soporte de My House, pide ver los movimientos y cuentas del hogar por {a.horas} {a.horas === 1 ? "hora" : "horas"}: «{a.motivo}».
              </>
            ) : (
              <>
                <b>{a.staff_nombre}</b>, de soporte, puede ver los datos del hogar hasta: {formatearMomento(a.vence).toLowerCase()}. Cada vista queda registrada.
              </>
            )}
          </p>
          <span className="flex gap-2">
            {a.estado === "pedido" ? (
              <>
                <FormularioAccion accion={responderAcceso} className="inline-flex">
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="accion" value="aprobar" />
                  <BotonEnviar className="h-9 px-3 text-sm" pendiente="…">
                    Aprobar
                  </BotonEnviar>
                </FormularioAccion>
                <FormularioAccion accion={responderAcceso} className="inline-flex">
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="accion" value="rechazar" />
                  <BotonEnviar variante="secundario" className="h-9 px-3 text-sm" pendiente="…">
                    Rechazar
                  </BotonEnviar>
                </FormularioAccion>
              </>
            ) : (
              <FormularioAccion accion={responderAcceso} className="inline-flex">
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="accion" value="revocar" />
                <BotonEnviar variante="secundario" className="h-9 px-3 text-sm" pendiente="…">
                  Revocar acceso
                </BotonEnviar>
              </FormularioAccion>
            )}
          </span>
        </section>
      ))}
    </div>
  );
}
