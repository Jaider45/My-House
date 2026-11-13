import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Markdown } from "@/lib/texto/markdown";
import { documentoPublicado, variablesLegales } from "@/lib/legal/documentos";
import { camposPendientes } from "@/lib/legal/empresa";
import { fechaVersion } from "@/lib/legal/responsable";
import { hoy } from "@/lib/fechas";

/**
 * Documento legal vigente, tal como lo publicó el equipo en Consola → Legal (Markdown con los datos de la empresa de
 * Ajustes de la plataforma). Si hay una versión publicada que aún no entra en vigencia, se anuncia arriba.
 */
export async function DocumentoLegal({ clave }: { clave: string }) {
  await connection();
  const [doc, variables] = await Promise.all([documentoPublicado(clave, hoy()), variablesLegales()]);
  if (!doc) notFound();
  const pendientes = camposPendientes(variables);
  return (
    <>
      <header className="mb-6 space-y-2">
        {pendientes.length > 0 && (
          <p className="rounded-lg border border-alerta bg-alerta-fondo px-3 py-2 text-sm text-alerta-tinta">
            Borrador: faltan los datos de la empresa ({pendientes.join(", ")}).
          </p>
        )}
        <h1 className="text-[28px] leading-[34px] font-bold md:text-[32px] md:leading-[38px]">{doc.nombre}</h1>
        <p className="text-sm text-tenue">
          Versión {doc.version} · vigente desde el {fechaVersion(doc.vigente_desde)}
        </p>
        {doc.proxima && (
          <p className="rounded-lg border border-borde bg-mosaico px-3 py-2 text-sm">
            <b>
              Desde el {fechaVersion(doc.proxima.vigente_desde)} rige la versión {doc.proxima.version}.
            </b>{" "}
            {doc.proxima.resumen}
          </p>
        )}
      </header>
      <Markdown texto={doc.contenido} variables={variables} />
    </>
  );
}
