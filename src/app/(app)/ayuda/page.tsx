import type { Metadata } from "next";
import Link from "next/link";
import { AreaTexto, Campo, Chip, Selector, Tarjeta, Titulo, type Tono } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioEstado } from "@/components/ui/formulario-estado";
import { obtenerContexto } from "@/lib/sesion";
import { formatearMomento } from "@/lib/consola/formato";
import { formatearFechaLarga } from "@/lib/fechas";
import { crearTicket, solicitarDatos } from "./acciones";
import { ESTADO_TICKET } from "./estados";

export const metadata: Metadata = { title: "Ayuda" };

const TIPOS_DATOS: Record<string, string> = {
  consulta: "Saber qué datos tienen de mí",
  actualizacion: "Corregir mis datos",
  supresion: "Borrar mi cuenta y mis datos",
  revocatoria: "Retirar mi autorización",
  reclamo: "Otro reclamo sobre mis datos",
};
const ESTADO_DATOS: Record<string, { texto: string; tono: Tono }> = {
  recibida: { texto: "Recibida", tono: "neutro" },
  en_tramite: { texto: "En trámite", tono: "alerta" },
  resuelta: { texto: "Resuelta", tono: "ok" },
  rechazada: { texto: "Rechazada", tono: "error" },
};

async function Contenido() {
  const ctx = await obtenerContexto();
  const [{ data: tickets }, { data: solicitudes }] = await Promise.all([
    ctx.supabase.from("tickets").select("id, numero, asunto, estado, ultimo_mensaje").order("ultimo_mensaje", { ascending: false }).limit(30),
    ctx.supabase.from("solicitudes_privacidad").select("id, numero, tipo, estado, recibida, vence, respuesta").order("created_at", { ascending: false }),
  ]);

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
      <div className="flex min-w-0 flex-col gap-5">
        <Tarjeta titulo="Escríbenos" subtitulo="Te respondemos por aquí y por correo, normalmente el mismo día hábil">
          <FormularioEstado accion={crearTicket} className="flex flex-col gap-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Campo etiqueta="Asunto" name="asunto" required minLength={3} maxLength={120} placeholder="No puedo importar el extracto de mi banco" />
              <Selector etiqueta="Tema" name="categoria" defaultValue="otro">
                <option value="cuenta">Entrar a mi cuenta</option>
                <option value="cobros">Pagos y plan</option>
                <option value="importacion">Importar extractos</option>
                <option value="ia">Comprobantes con IA</option>
                <option value="renta">Renta DIAN</option>
                <option value="otro">Otro</option>
              </Selector>
            </div>
            <AreaTexto etiqueta="¿Qué pasó?" name="cuerpo" rows={5} required minLength={5} maxLength={5000} placeholder="Cuéntanos qué intentabas hacer y qué viste. No incluyas contraseñas ni números de tarjeta." />
            <BotonEnviar pendiente="Enviando…" className="self-start">
              Enviar
            </BotonEnviar>
          </FormularioEstado>
        </Tarjeta>

        <section className="overflow-hidden rounded-2xl border border-borde bg-elevada">
          <div className="px-4 pt-4 md:px-6 md:pt-5">
            <h2 className="text-[17px] leading-[22px] font-bold md:text-xl md:leading-[26px]">Tus solicitudes</h2>
          </div>
          {tickets?.length ? (
            <ul className="mt-2 divide-y divide-divisor">
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link href={`/ayuda/${t.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-mosaico/60 md:px-6">
                    <span className="flex min-w-0 flex-col">
                      <b className="truncate">{t.asunto}</b>
                      <small className="text-[13px] text-tenue">
                        #{t.numero} · {formatearMomento(t.ultimo_mensaje)}
                      </small>
                    </span>
                    <Chip tono={ESTADO_TICKET[t.estado].tono}>{ESTADO_TICKET[t.estado].texto}</Chip>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 pt-1 pb-4 text-sm text-tenue md:px-6">Aún no nos has escrito.</p>
          )}
        </section>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <Tarjeta titulo="Tus datos personales" subtitulo="Ley 1581 de 2012: puedes conocerlos, corregirlos o pedir que los borremos">
          <FormularioEstado accion={solicitarDatos} className="flex flex-col gap-3">
            <Selector etiqueta="Quiero" name="tipo" defaultValue="consulta">
              {Object.entries(TIPOS_DATOS).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </Selector>
            <AreaTexto etiqueta="Detalle (opcional)" name="detalle" rows={3} maxLength={2000} placeholder="Qué dato corregir, o cualquier aclaración." />
            <label className="flex items-start gap-2 text-[13px] text-cuerpo">
              <input type="checkbox" name="confirmo" className="mt-0.5 size-4 accent-monte" />
              Si pido borrar: entiendo que se eliminan mi cuenta y los hogares donde soy la única persona con acceso (movimientos y soportes
              incluidos). En los hogares compartidos los datos se quedan con las demás personas.
            </label>
            <BotonEnviar variante="secundario" pendiente="Enviando…" className="self-start">
              Enviar solicitud
            </BotonEnviar>
          </FormularioEstado>
          <p className="mt-3 text-[13px] text-tenue">Una consulta se responde en máximo 10 días hábiles; un reclamo (corregir, borrar, retirar la autorización), en 15.</p>
        </Tarjeta>

        {solicitudes && solicitudes.length > 0 && (
          <Tarjeta titulo="Solicitudes sobre tus datos">
            <ul className="flex flex-col">
              {solicitudes.map((s) => (
                <li key={s.id} className="flex flex-col gap-1 border-b border-divisor py-2.5 text-sm last:border-0">
                  <span className="flex items-center justify-between gap-2">
                    <b>
                      #{s.numero} · {TIPOS_DATOS[s.tipo]}
                    </b>
                    <Chip tono={ESTADO_DATOS[s.estado].tono}>{ESTADO_DATOS[s.estado].texto}</Chip>
                  </span>
                  <span className="text-[13px] text-tenue">
                    {s.estado === "recibida" || s.estado === "en_tramite" ? `Respuesta a más tardar el ${formatearFechaLarga(s.vence)}` : (s.respuesta ?? "")}
                  </span>
                </li>
              ))}
            </ul>
          </Tarjeta>
        )}
      </div>
    </div>
  );
}

export default function Ayuda() {
  return (
    <>
      <Titulo registrar={false} subtitulo="Escríbele al equipo de My House y maneja tus datos personales">
        Ayuda
      </Titulo>
      <Contenido />
    </>
  );
}
