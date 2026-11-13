import { connection } from "next/server";
import { AreaTexto, Campo } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioEstado } from "@/components/ui/formulario-estado";
import { crearClienteServidor } from "@/lib/supabase/server";
import { variablesLegales } from "@/lib/legal/documentos";
import { Markdown } from "@/lib/texto/markdown";
import { formatearMomento } from "@/lib/consola/formato";
import { Comparacion } from "@/app/consola/(panel)/legal/editor";
import { responderRevision } from "./acciones";

export const metadata = { title: "Revisión legal", robots: { index: false } };

type Revision = {
  documento: string;
  version: string;
  contenido: string;
  resumen: string;
  estado: string;
  vence: string;
  nota: string | null;
  revisado_por: string | null;
  anterior: string | null;
  version_anterior: string | null;
};

/** Enlace personal del abogado (Consola → Legal → «Enviar al abogado»): ver, comparar y aprobar sin cuenta. */
export default async function RevisionLegal({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const supabase = await crearClienteServidor();
  const [{ data }, variables] = await Promise.all([supabase.rpc("revision_legal_ver", { p_token: token }), variablesLegales()]);
  const r = data as Revision | null;
  if (!r) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">El enlace venció o ya no es válido</h1>
        <p className="text-cuerpo">Pide al equipo de My House que te envíe uno nuevo.</p>
      </div>
    );
  }
  return (
    <>
      <header className="space-y-1">
        <p className="text-xs font-bold tracking-[0.08em] text-tenue uppercase">Revisión legal</p>
        <h1 className="text-[28px] leading-[34px] font-bold">
          {r.documento} · versión {r.version}
        </h1>
        <p className="text-sm text-tenue">El enlace vence {formatearMomento(r.vence).toLowerCase()}.</p>
      </header>
      {r.resumen && (
        <p className="rounded-lg bg-mosaico px-3 py-2 text-sm">
          <b>Resumen para los usuarios:</b> {r.resumen}
        </p>
      )}
      {r.anterior && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold">Cambios frente a la versión {r.version_anterior}</h2>
          <Comparacion antes={r.anterior} despues={r.contenido} />
        </section>
      )}
      <section className="space-y-2">
        <h2 className="text-lg font-bold">Texto completo</h2>
        <div className="rounded-xl border border-borde bg-elevada p-4">
          <Markdown texto={r.contenido} variables={variables} />
        </div>
      </section>
      {r.estado === "en_revision" ? (
        <FormularioEstado accion={responderRevision} className="space-y-3 rounded-xl border border-borde bg-elevada p-4">
          <input type="hidden" name="token" value={token} />
          <Campo etiqueta="Tu nombre" name="nombre" required maxLength={120} autoComplete="name" />
          <AreaTexto etiqueta="Comentarios (obligatorios si pides cambios)" name="nota" rows={4} maxLength={2000} />
          <div className="flex flex-wrap gap-2">
            <BotonEnviar name="decision" value="aprobar" pendiente="Enviando…">
              Aprobar esta versión
            </BotonEnviar>
            <BotonEnviar name="decision" value="cambios" variante="secundario" pendiente="Enviando…">
              Pedir cambios
            </BotonEnviar>
          </div>
        </FormularioEstado>
      ) : (
        <p className="rounded-lg bg-ok-fondo px-3 py-2 text-sm text-ok-tinta">
          Ya respondiste esta revisión{r.revisado_por ? ` (${r.revisado_por})` : ""}. Gracias.
        </p>
      )}
    </>
  );
}
