import type { Metadata } from "next";
import Link from "next/link";
import { Aviso, Chip, Titulo, cx, type Tono } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import { Icono } from "@/components/marca";
import { obtenerStaff } from "@/lib/consola/sesion";
import { formatearMomento } from "@/lib/consola/formato";
import { fechaVersion } from "@/lib/legal/responsable";
import { variablesLegales } from "@/lib/legal/documentos";
import { formatearFechaLarga, hoy } from "@/lib/fechas";
import { Markdown } from "@/lib/texto/markdown";
import { TarjetaTabla } from "../tarjeta-tabla";
import { EditorVersion, type VersionEditable } from "./editor";
import { nuevaVersion, nuevoDocumento, publicarVersion } from "./acciones";
import { Campo } from "@/components/ui";

export const metadata: Metadata = { title: "Legal" };

type Version = VersionEditable & {
  revision_vence: string | null;
  revision_nota: string | null;
  revisado_por: string | null;
  revisado_en: string | null;
  editado_nombre: string | null;
  updated_at: string;
  publicada_en: string | null;
  aviso_enviado_en: string | null;
};
type Documento = {
  clave: string;
  nombre: string;
  consentimiento: string | null;
  obligatorio: boolean;
  vigente: string | null;
  exigida: string | null;
  versiones: Version[];
  aceptaron: number | null;
};

const ESTADO: Record<Version["estado"], { texto: string; tono: Tono }> = {
  borrador: { texto: "Borrador", tono: "info" },
  en_revision: { texto: "Con el abogado", tono: "alerta" },
  aprobada: { texto: "Aprobada", tono: "ok" },
  publicada: { texto: "Publicada", tono: "ok" },
};

/** Dónde se ve cada documento en la app (enlaces que existen en el código). */
const DONDE = [
  "Registro y onboarding · casillas de aceptación",
  "Inicio de sesión · pie de página",
  "Configuración · Privacidad y datos",
  "Ventana de aceptación al publicar una versión que la pide",
  "Pie de todos los correos",
];

const RUTA: Record<string, string> = { politica_datos: "/privacidad", terminos: "/terminos" };

export default async function Legal({ searchParams }: { searchParams: Promise<{ doc?: string; nuevo?: string }> }) {
  const staff = await obtenerStaff();
  const sp = await searchParams;
  const [{ data, error }, variables] = await Promise.all([staff.supabase.rpc("consola_legal"), variablesLegales()]);
  const hoyBogota = hoy();
  const datos = (data ?? { usuarios: 0, documentos: [] }) as { usuarios: number; documentos: Documento[] };
  const docs = datos.documentos;
  const doc = docs.find((d) => d.clave === sp.doc) ?? docs.find((d) => d.versiones.some((v) => v.estado !== "publicada")) ?? docs[0];
  const puede = staff.puede("contenido_app");
  const editable = doc?.versiones.find((v) => v.estado !== "publicada") ?? null;
  const publicadas = doc?.versiones.filter((v) => v.estado === "publicada") ?? [];
  const vigente = publicadas.find((v) => v.vigente_desde! <= hoyBogota) ?? null;
  const programada = publicadas.find((v) => v.vigente_desde! > hoyBogota) ?? null;

  return (
    <>
      <Titulo registrar={false} subtitulo="Políticas, términos y autorizaciones con versiones y registro de aceptación">
        Legal
      </Titulo>
      {error && <Aviso>No se pudieron cargar los documentos: {error.message}</Aviso>}

      <div className="grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <aside className="flex flex-col gap-2 rounded-2xl border border-borde bg-elevada p-4">
          <b>Documentos</b>
          {docs.map((d) => {
            const v = d.versiones.find((x) => x.estado !== "publicada");
            const vig = d.versiones.find((x) => x.estado === "publicada" && x.vigente_desde! <= hoyBogota);
            return (
              <Link
                key={d.clave}
                href={`/consola/legal?doc=${d.clave}`}
                aria-current={d.clave === doc?.clave ? "page" : undefined}
                className={cx("flex items-center gap-3 rounded-xl border p-3", d.clave === doc?.clave ? "border-monte bg-seleccion" : "border-transparent hover:bg-mosaico")}
              >
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-mosaico">
                  <Icono nombre="certificados" tamano={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-sm leading-5">{d.nombre}</b>
                  <span className="text-[13px] text-tenue">
                    {vig ? `v${vig.version} vigente` : "Sin versión vigente"}
                    {v ? ` · v${v.version} en ${ESTADO[v.estado].texto.toLowerCase()}` : ""}
                  </span>
                </span>
                {v ? <Chip tono={ESTADO[v.estado].tono}>{v.estado === "aprobada" ? "Lista" : ESTADO[v.estado].texto}</Chip> : <Chip tono="ok">Vigente</Chip>}
              </Link>
            );
          })}
          {puede && (
            <FormularioAccion accion={nuevoDocumento} className="mt-2 flex flex-col gap-2 border-t border-divisor pt-3">
              <Campo etiqueta="Nuevo documento" name="nombre" placeholder="Política de cookies" maxLength={80} />
              <BotonEnviar variante="secundario" className="h-9 text-sm" pendiente="Creando…">
                Crear documento
              </BotonEnviar>
            </FormularioAccion>
          )}
          <p className="mt-1 text-[13px] text-tenue">Todos pasan por revisión de un abogado antes de publicarse.</p>
        </aside>

        {doc ? (
          <section className="flex min-w-0 flex-col gap-4 rounded-2xl border border-borde bg-elevada p-4 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-[0.08em] text-tenue uppercase">{doc.nombre}</p>
                <h2 className="text-xl leading-7 font-bold">
                  {editable ? `Versión ${editable.version} · ${ESTADO[editable.estado].texto.toLowerCase()}` : vigente ? `Versión ${vigente.version} · vigente` : "Sin versiones"}
                </h2>
                {editable?.editado_nombre && (
                  <p className="text-sm text-tenue">
                    Editada por {editable.editado_nombre} · {formatearMomento(editable.updated_at)}
                  </p>
                )}
              </div>
              <Link href={RUTA[doc.clave] ?? `/legal/${doc.clave}`} target="_blank" className="text-sm font-semibold underline-offset-4 hover:underline">
                Ver publicado
              </Link>
            </div>

            {programada && (
              <Aviso tipo="info">
                La versión {programada.version} ya está publicada y rige desde el {fechaVersion(programada.vigente_desde!)}.
                {programada.avisar_correo && (programada.aviso_enviado_en ? " El aviso por correo ya salió." : " El aviso por correo sale 10 días antes.")}
              </Aviso>
            )}
            {editable?.estado === "en_revision" && (
              <Aviso tipo="info">
                Enviada a {editable.revision_correo} · el enlace vence {editable.revision_vence ? formatearMomento(editable.revision_vence).toLowerCase() : "pronto"}. Si cambias el
                texto, hay que enviarla de nuevo.
              </Aviso>
            )}
            {editable?.revision_nota && (
              <Aviso tipo={editable.estado === "aprobada" ? "ok" : "info"}>
                <b>{editable.revisado_por}</b> {editable.estado === "aprobada" ? "la aprobó" : "pidió cambios"}: «{editable.revision_nota}»
              </Aviso>
            )}
            {editable?.estado === "aprobada" && !editable.revision_nota && <Aviso tipo="ok">Aprobada por {editable.revisado_por}. Ya puedes publicarla.</Aviso>}

            {editable ? (
              <>
                <EditorVersion
                  v={editable}
                  documento={doc.nombre}
                  anterior={vigente ? { version: vigente.version, contenido: vigente.contenido } : null}
                  variables={variables}
                  hoy={hoyBogota}
                  puedeEditar={puede}
                />
                <div className="flex flex-col gap-2 border-t border-divisor pt-4">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="text-cuerpo">Revisión del abogado</span>
                    <Chip tono={editable.estado === "aprobada" ? "ok" : "alerta"}>{editable.estado === "aprobada" ? `Aprobada · ${editable.revisado_por}` : "Pendiente"}</Chip>
                  </div>
                  {puede && (
                    <FormularioAccion accion={publicarVersion} className="flex flex-col items-start gap-1">
                      <input type="hidden" name="id" value={editable.id} />
                      <BotonEnviar disabled={editable.estado !== "aprobada" || !editable.vigente_desde} pendiente="Publicando…">
                        Publicar versión {editable.version}
                      </BotonEnviar>
                      <span className="text-[13px] text-tenue">
                        {editable.estado !== "aprobada"
                          ? "Se podrá publicar cuando el abogado la apruebe."
                          : !editable.vigente_desde
                            ? "Elige la fecha de vigencia y guarda."
                            : `Rige desde el ${formatearFechaLarga(editable.vigente_desde)}.`}
                      </span>
                    </FormularioAccion>
                  )}
                </div>
              </>
            ) : (
              <>
                {vigente && (
                  <div className="max-h-[520px] overflow-y-auto rounded-xl border border-borde p-4">
                    <Markdown texto={vigente.contenido} variables={variables} />
                  </div>
                )}
                {puede && (
                  <div className="flex flex-wrap gap-2">
                    <FormularioAccion accion={nuevaVersion} className="inline-flex flex-col">
                      <input type="hidden" name="doc" value={doc.clave} />
                      <input type="hidden" name="mayor" value="0" />
                      <BotonEnviar variante="secundario" pendiente="Creando…">
                        Ajuste menor (no pide aceptar)
                      </BotonEnviar>
                    </FormularioAccion>
                    <FormularioAccion accion={nuevaVersion} className="inline-flex flex-col">
                      <input type="hidden" name="doc" value={doc.clave} />
                      <input type="hidden" name="mayor" value="1" />
                      <BotonEnviar pendiente="Creando…">Versión nueva (pide aceptar)</BotonEnviar>
                    </FormularioAccion>
                  </div>
                )}
              </>
            )}

            {publicadas.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer font-semibold">Historial de versiones</summary>
                <ul className="mt-2 flex flex-col">
                  {publicadas.map((v) => (
                    <li key={v.id} className="flex justify-between gap-3 border-b border-divisor py-2 last:border-0">
                      <span>
                        <b>v{v.version}</b> · {v.resumen || "Sin resumen"}
                      </span>
                      <span className="shrink-0 text-tenue">desde {fechaVersion(v.vigente_desde!)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        ) : (
          <p className="text-sm text-tenue">Aún no hay documentos.</p>
        )}

        <div className="flex flex-col gap-5">
          <section className="rounded-2xl border border-borde bg-elevada p-4 md:p-6">
            <h2 className="mb-2 text-[17px] font-bold md:text-xl">Dónde aparecen en la app</h2>
            <ul className="flex flex-col">
              {DONDE.map((d) => (
                <li key={d} className="flex items-center justify-between gap-3 border-b border-divisor py-2.5 text-sm last:border-0">
                  <span className="text-cuerpo">{d}</span>
                  <Chip tono="ok">Visible</Chip>
                </li>
              ))}
            </ul>
          </section>
          <TarjetaTabla titulo="Aceptaciones" subtitulo="Quién, qué versión, cuándo y desde dónde queda en cada cuenta">
            <table className="tabla">
              <thead>
                <tr>
                  <th className="pl-4! md:pl-6!">Documento</th>
                  <th>Versión</th>
                  <th className="der">Aceptaron</th>
                  <th className="der pr-4! md:pr-6!">Pendientes</th>
                </tr>
              </thead>
              <tbody>
                {docs
                  .filter((d) => d.consentimiento)
                  .map((d) => {
                    const exigida = d.versiones.find((v) => v.estado === "publicada" && v.vigente_desde === d.exigida);
                    const pendientes = Math.max(0, datos.usuarios - (d.aceptaron ?? 0));
                    return (
                      <tr key={d.clave}>
                        <td className="pl-4! font-semibold whitespace-normal! md:pl-6!">{d.nombre}</td>
                        <td className="text-cuerpo">{d.obligatorio ? (exigida ? `v${exigida.version}` : "—") : "Opcional"}</td>
                        <td className="der">{(d.aceptaron ?? 0).toLocaleString("es-CO")}</td>
                        <td className="der pr-4! md:pr-6!">{d.obligatorio ? pendientes.toLocaleString("es-CO") : `${pendientes.toLocaleString("es-CO")} no aceptaron`}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </TarjetaTabla>
        </div>
      </div>
    </>
  );
}
