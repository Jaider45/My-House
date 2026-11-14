import Link from "next/link";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import { obtenerContexto } from "@/lib/sesion";
import { pendientesLegales } from "@/lib/legal/documentos";
import { fechaVersion } from "@/lib/legal/responsable";
import { aceptarDocumentos } from "./aviso-legal-accion";

const RUTA: Record<string, string> = { politica_datos: "/privacidad", terminos: "/terminos" };

/**
 * Consola → Legal publicó una versión que pide aceptación de nuevo: la persona la ve al entrar y acepta para seguir
 * usando la app (Ley 1581: la autorización debe ser expresa para la versión que rige). Queda en `consentimientos`.
 */
export async function AvisoLegal() {
  const ctx = await obtenerContexto();
  const pendientes = await pendientesLegales(ctx.supabase);
  if (!pendientes.length) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-tinta/40 p-0 md:items-center md:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="aviso-legal-titulo"
        className="flex max-h-[90dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-2xl bg-elevada p-5 md:rounded-2xl md:p-6"
      >
        <h2 id="aviso-legal-titulo" className="text-xl leading-7 font-bold">
          Actualizamos {pendientes.length === 1 ? pendientes[0].nombre.toLowerCase() : "nuestros documentos"}
        </h2>
        {pendientes.map((p) => (
          <div key={p.clave} className="rounded-xl border border-borde p-4 text-sm">
            <p className="font-semibold">
              {p.nombre} · versión {p.version}
            </p>
            <p className="text-[13px] text-tenue">Vigente desde el {fechaVersion(p.vigente_desde)}</p>
            {p.resumen && <p className="mt-2 text-cuerpo">{p.resumen}</p>}
            <Link href={RUTA[p.clave] ?? `/legal/${p.clave}`} target="_blank" className="mt-2 inline-block font-semibold text-monte underline underline-offset-2">
              Leer el documento completo
            </Link>
          </div>
        ))}
        <FormularioAccion accion={aceptarDocumentos} className="flex flex-col gap-2">
          <BotonEnviar pendiente="Guardando…">Acepto</BotonEnviar>
          <p className="text-[13px] text-tenue">
            Si no estás de acuerdo, puedes pedir que eliminemos tu cuenta en Configuración → Privacidad y datos, o escribirnos desde Ayuda.
          </p>
        </FormularioAccion>
      </section>
    </div>
  );
}
