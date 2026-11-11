import { AreaTexto, Campo, Chip, Selector, Tarjeta, type Tono } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioEstado } from "@/components/ui/formulario-estado";
import { obtenerStaff } from "@/lib/consola/sesion";
import { formatearFechaCorta } from "@/lib/consola/formato";
import { hoy } from "@/lib/fechas";
import { TarjetaTabla } from "../tarjeta-tabla";
import { ejecutarSupresion, registrarSolicitud, responderSolicitud } from "./acciones";

type Solicitud = {
  id: string;
  numero: number;
  tipo: string;
  titular_correo: string;
  titular_nombre: string | null;
  canal: string;
  detalle: string | null;
  estado: string;
  recibida: string;
  vence: string;
  respuesta: string | null;
  exportada_en: string | null;
  suprimida_en: string | null;
  tiene_cuenta: boolean;
  dias_habiles_restantes: number | null;
};

const TIPO: Record<string, string> = { consulta: "Consulta", actualizacion: "Corrección", supresion: "Supresión", revocatoria: "Revocatoria", reclamo: "Reclamo" };
const ESTADO: Record<string, { texto: string; tono: Tono }> = {
  recibida: { texto: "Recibida", tono: "alerta" },
  en_tramite: { texto: "En trámite", tono: "info" },
  resuelta: { texto: "Resuelta", tono: "ok" },
  rechazada: { texto: "Rechazada", tono: "neutro" },
};
const control = "h-9 rounded-lg border border-control bg-elevada px-2 text-sm";

function Plazo({ s }: { s: Solicitud }) {
  if (s.dias_habiles_restantes === null) return <span className="text-tenue">—</span>;
  const n = s.dias_habiles_restantes;
  const tono: Tono = n <= 2 ? "error" : n <= 5 ? "alerta" : "neutro";
  return (
    <span className="flex flex-col leading-[18px]">
      <Chip tono={tono}>{n === 0 ? "Vence hoy" : `${n} ${n === 1 ? "día hábil" : "días hábiles"}`}</Chip>
      <small className="text-xs text-tenue">hasta {formatearFechaCorta(`${s.vence}T12:00:00`)}</small>
    </span>
  );
}

/** Solicitudes de titulares (Ley 1581): plazo en días hábiles con festivos de Colombia, respuesta, exportación y supresión. */
export async function SolicitudesPrivacidad() {
  const staff = await obtenerStaff();
  const { data } = await staff.supabase.rpc("consola_solicitudes_privacidad");
  const lista = (data ?? []) as unknown as Solicitud[];
  const abiertas = lista.filter((s) => s.estado === "recibida" || s.estado === "en_tramite");

  return (
    <div className="mb-5 grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
      <TarjetaTabla
        titulo="Solicitudes de titulares · Ley 1581"
        subtitulo={`Consulta: 10 días hábiles · reclamo, corrección o supresión: 15 · ${abiertas.length} ${abiertas.length === 1 ? "abierta" : "abiertas"}`}
      >
        {lista.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-tenue md:px-6">No hay solicitudes. Las hacen los titulares desde Ayuda o llegan al correo de datos.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-divisor">
            {lista.map((s) => {
              const abierta = s.estado === "recibida" || s.estado === "en_tramite";
              return (
                <li key={s.id} className="px-4 py-3 md:px-6">
                  <details>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                      <span className="flex min-w-0 flex-col leading-[18px]">
                        <b>
                          #{s.numero} · {TIPO[s.tipo]} · {s.titular_nombre ?? s.titular_correo}
                        </b>
                        <small className="text-xs text-tenue">
                          {s.titular_correo} · por {s.canal === "app" ? "la app" : "correo"} · recibida {formatearFechaCorta(`${s.recibida}T12:00:00`)}
                          {s.tiene_cuenta ? "" : " · sin cuenta en My House"}
                        </small>
                      </span>
                      <span className="flex items-center gap-2">
                        {abierta && <Plazo s={s} />}
                        <Chip tono={ESTADO[s.estado].tono}>{ESTADO[s.estado].texto}</Chip>
                      </span>
                    </summary>
                    <div className="mt-3 flex flex-col gap-3 rounded-xl bg-pagina p-3">
                      {s.detalle && <p className="text-sm whitespace-pre-line">«{s.detalle}»</p>}
                      {s.respuesta && <p className="text-sm text-cuerpo">Respuesta: {s.respuesta}</p>}
                      {s.tiene_cuenta && (
                        <p className="flex flex-wrap gap-3 text-sm">
                          <a href={`/consola/privacidad/solicitudes/${s.id}/exportar`} className="font-semibold underline">
                            Descargar datos (JSON con soportes)
                          </a>
                          <a href={`/consola/privacidad/solicitudes/${s.id}/exportar?formato=csv`} className="font-semibold underline">
                            Movimientos (CSV)
                          </a>
                          {s.exportada_en && <span className="text-tenue">Exportada {formatearFechaCorta(s.exportada_en)}</span>}
                        </p>
                      )}
                      {abierta && (
                        <FormularioEstado accion={responderSolicitud} className="flex flex-col gap-2">
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="numero" value={s.numero} />
                          <input type="hidden" name="tipo" value={s.tipo} />
                          <AreaTexto etiqueta="Respuesta al titular (se le envía por correo)" name="respuesta" rows={3} maxLength={4000} />
                          <div className="flex flex-wrap items-center gap-2">
                            <select name="estado" defaultValue="resuelta" aria-label="Estado" className={control}>
                              <option value="en_tramite">En trámite</option>
                              <option value="resuelta">Resuelta</option>
                              <option value="rechazada">Rechazada</option>
                            </select>
                            <BotonEnviar variante="secundario" className="h-9 text-sm" pendiente="Guardando…">
                              Guardar
                            </BotonEnviar>
                          </div>
                        </FormularioEstado>
                      )}
                      {s.tipo === "supresion" && !s.suprimida_en && s.tiene_cuenta && (
                        <FormularioEstado accion={ejecutarSupresion} className="flex flex-col gap-2 rounded-xl border border-error p-3">
                          <input type="hidden" name="id" value={s.id} />
                          <p className="text-sm text-error-tinta">
                            Borra los hogares donde es la única persona con cuenta (movimientos y soportes), retira sus datos de los compartidos y
                            cierra su cuenta. No se puede deshacer.
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <input name="confirmar" placeholder="Escribe SUPRIMIR" aria-label="Confirmación" autoComplete="off" className={control} />
                            <BotonEnviar variante="peligro" className="h-9 text-sm" pendiente="Suprimiendo…">
                              Ejecutar supresión
                            </BotonEnviar>
                          </div>
                        </FormularioEstado>
                      )}
                      {s.suprimida_en && <p className="text-sm text-tenue">Supresión ejecutada {formatearFechaCorta(s.suprimida_en)}.</p>}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </TarjetaTabla>

      <Tarjeta titulo="Registrar una solicitud" subtitulo="Las que llegan por correo: el plazo corre desde que se recibió">
        <FormularioEstado accion={registrarSolicitud} className="flex flex-col gap-3">
          <Selector etiqueta="Tipo" name="tipo" defaultValue="consulta">
            {Object.entries(TIPO).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </Selector>
          <Campo etiqueta="Correo del titular" name="correo" type="email" required />
          <Campo etiqueta="Nombre" name="nombre" maxLength={120} />
          <Campo etiqueta="Recibida el" name="recibida" type="date" defaultValue={hoy()} max={hoy()} required />
          <AreaTexto etiqueta="Qué pide" name="detalle" rows={3} maxLength={2000} />
          <BotonEnviar variante="secundario" className="self-start" pendiente="Guardando…">
            Registrar
          </BotonEnviar>
        </FormularioEstado>
      </Tarjeta>
    </div>
  );
}
