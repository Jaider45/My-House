import type { Metadata } from "next";
import { Aviso, EnlaceBoton, Tarjeta, Titulo } from "@/components/ui";
import { mensajeError } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { describirAccion } from "@/lib/consola/auditoria";
import { formatearMomento } from "@/lib/consola/formato";
import { hoy, sumarDias } from "@/lib/fechas";
import { TarjetaTabla } from "../tarjeta-tabla";

export const metadata: Metadata = { title: "Privacidad y auditoría" };

const POR_PAGINA = 50;

export default async function PrivacidadConsola({ searchParams }: PageProps<"/consola/privacidad">) {
  const staff = await obtenerStaff();
  if (!staff.puede("auditoria")) {
    return (
      <>
        <Titulo registrar={false} subtitulo="Ley 1581 de 2012 y registro de acciones del equipo">
          Privacidad y auditoría
        </Titulo>
        <Aviso tipo="info">Tu rol no puede ver la auditoría. Pídele acceso a un superadmin.</Aviso>
      </>
    );
  }

  const { antes } = await searchParams;
  const cursor = typeof antes === "string" && /^\d{1,18}$/.test(antes) ? Number(antes) : null;
  const { data, error } = await staff.supabase.rpc("consola_auditoria", { p_antes: cursor ?? undefined, p_limite: POR_PAGINA });
  const filas = data ?? [];
  const siguiente = filas.length === POR_PAGINA ? filas[filas.length - 1].id : null;
  const finMes = hoy();

  return (
    <>
      <Titulo registrar={false} subtitulo="Ley 1581 de 2012 y registro de acciones del equipo">
        Privacidad y auditoría
      </Titulo>
      {error && <Aviso>{mensajeError(error)}</Aviso>}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <TarjetaTabla
          titulo="Registro de auditoría"
          subtitulo="Todo lo que hace el equipo queda aquí · no se puede editar"
          className="min-w-0"
        >
          {filas.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-tenue md:px-6">Aún no hay registros.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th className="pl-4! md:pl-6!">Fecha</th>
                    <th>Quién</th>
                    <th>Acción</th>
                    <th className="pr-4! md:pr-6!">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.id}>
                      <td className="pl-4! text-cuerpo md:pl-6!">{formatearMomento(f.creada)}</td>
                      <td className="font-semibold">{f.quien_nombre}</td>
                      <td className="whitespace-normal!">{describirAccion(f)}</td>
                      <td className="pr-4! text-cuerpo md:pr-6!">{f.ip ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(cursor || siguiente) && (
            <div className="flex justify-between gap-3 px-4 pt-3 md:px-6">
              {cursor ? (
                <EnlaceBoton href="/consola/privacidad" variante="secundario" className="h-9 text-sm">
                  Más recientes
                </EnlaceBoton>
              ) : (
                <span />
              )}
              {siguiente && (
                <EnlaceBoton href={`/consola/privacidad?antes=${siguiente}`} variante="secundario" className="h-9 text-sm">
                  Más antiguos
                </EnlaceBoton>
              )}
            </div>
          )}
        </TarjetaTabla>

        <div className="flex min-w-0 flex-col gap-5">
          <Tarjeta titulo="Exportar" subtitulo="CSV con IP y navegador completos. La exportación también queda registrada.">
            {/* GET a un route handler: descarga directa, sin JS. */}
            <form action="/consola/privacidad/exportar" method="get" className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-cuerpo">
                  Desde
                  <input type="date" name="desde" required defaultValue={sumarDias(finMes, -30)} className="h-11 rounded-lg border border-control bg-elevada px-3 text-[15px] text-tinta" />
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-cuerpo">
                  Hasta
                  <input type="date" name="hasta" required defaultValue={finMes} className="h-11 rounded-lg border border-control bg-elevada px-3 text-[15px] text-tinta" />
                </label>
              </div>
              <button type="submit" className="inline-flex h-10 items-center justify-center rounded-lg border border-cuerpo bg-elevada px-4 text-[15px] font-semibold text-tinta hover:bg-mosaico">
                Descargar CSV
              </button>
            </form>
          </Tarjeta>
          <Tarjeta titulo="Solicitudes de titulares · Ley 1581">
            <p className="text-sm text-cuerpo">
              Consultas, reclamos y supresiones con sus plazos llegan en la fase S7 del roadmap. Mientras tanto se atienden por el
              canal de la política de datos.
            </p>
          </Tarjeta>
        </div>
      </div>
    </>
  );
}
