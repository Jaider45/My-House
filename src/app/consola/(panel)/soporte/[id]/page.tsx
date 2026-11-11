import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Aviso, Chip, Tarjeta, Titulo, cx } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioEstado } from "@/components/ui/formulario-estado";
import { mensajeError } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { formatearMomento } from "@/lib/consola/formato";
import { actualizarTicket } from "../acciones";
import { ResponderTicket } from "../responder";

export const metadata: Metadata = { title: "Ticket" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const control = "h-9 rounded-lg border border-control bg-elevada px-2 text-sm";

type Detalle = {
  ticket: { id: string; numero: number; asunto: string; categoria: string; prioridad: string; estado: string; escalado: boolean; asignado_a: string | null; creado_nombre: string; sla_vence: string; primera_respuesta: string | null; created_at: string };
  mensajes: { id: number; autor_nombre: string; de_equipo: boolean; interno: boolean; cuerpo: string; created_at: string }[];
  hogar: { id: string; nombre: string; plan: string; estado: string; miembros: number; created_at: string } | null;
  registro: { tipo: string; mensaje: string; detalle: Record<string, unknown>; created_at: string }[];
  otros: { id: string; numero: number; asunto: string; estado: string }[];
};

export default async function TicketConsola({ params }: PageProps<"/consola/soporte/[id]">) {
  const staff = await obtenerStaff();
  const { id } = await params;
  if (!UUID.test(id) || !staff.puede("tickets")) notFound();
  const [{ data, error }, { data: lista }] = await Promise.all([
    staff.supabase.rpc("consola_ticket", { p_id: id }),
    staff.supabase.rpc("consola_tickets", { p_estado: "ninguno", p_asignado: "todos" }),
  ]);
  if (error) return <Aviso>{mensajeError(error)}</Aviso>;
  const d = data as unknown as Detalle;
  const t = d.ticket;
  const extra = (lista ?? { respuestas: [], equipo: [] }) as unknown as { respuestas: { id: string; titulo: string; cuerpo: string }[]; equipo: { user_id: string; nombre: string }[] };

  return (
    <>
      <Titulo registrar={false} subtitulo={`#${t.numero} · ${t.creado_nombre} · ${formatearMomento(t.created_at)} · tema: ${t.categoria}`}>
        {t.asunto}
      </Titulo>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <ol className="flex flex-col gap-3">
            {d.mensajes.map((m) => (
              <li
                key={m.id}
                className={cx(
                  "max-w-[90%] rounded-2xl px-4 py-3",
                  m.interno ? "self-end border border-alerta bg-alerta-fondo" : m.de_equipo ? "self-end bg-seleccion" : "self-start border border-borde bg-elevada",
                )}
              >
                <p className="mb-1 text-[13px] font-semibold text-cuerpo">
                  {m.autor_nombre}
                  {m.interno ? " · nota interna" : m.de_equipo ? " · equipo" : ""} · <span className="font-normal text-tenue">{formatearMomento(m.created_at)}</span>
                </p>
                <p className="text-[15px] whitespace-pre-line">{m.cuerpo}</p>
              </li>
            ))}
          </ol>
          <Tarjeta>
            <ResponderTicket id={t.id} respuestas={extra.respuestas} nombre={t.creado_nombre.split(" ")[0]} />
          </Tarjeta>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Tarjeta titulo="Ticket">
            <FormularioEstado accion={actualizarTicket} className="flex flex-col gap-3 text-sm">
              <input type="hidden" name="id" value={t.id} />
              <label className="flex items-center justify-between gap-3">
                Prioridad
                <select name="prioridad" defaultValue={t.prioridad} className={control}>
                  <option value="urgente">Urgente (4 h)</option>
                  <option value="alta">Alta (8 h)</option>
                  <option value="normal">Normal (24 h)</option>
                  <option value="baja">Baja (72 h)</option>
                </select>
              </label>
              <label className="flex items-center justify-between gap-3">
                Estado
                <select name="estado" defaultValue={t.estado} className={control}>
                  <option value="abierto">Abierto</option>
                  <option value="esperando_cliente">Esperando al cliente</option>
                  <option value="resuelto">Resuelto</option>
                </select>
              </label>
              <label className="flex items-center justify-between gap-3">
                Asignado a
                <select name="asignado" defaultValue={t.asignado_a ?? ""} className={control}>
                  <option value="">Nadie</option>
                  {extra.equipo.map((p) => (
                    <option key={p.user_id} value={p.user_id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="escalado" defaultChecked={t.escalado} className="size-4 accent-monte" />
                Escalado (lo revisa un superadmin)
              </label>
              <p className="text-[13px] text-tenue">
                {t.primera_respuesta ? `Primera respuesta: ${formatearMomento(t.primera_respuesta)}` : `Responder antes de: ${formatearMomento(t.sla_vence)}`}
              </p>
              <BotonEnviar variante="secundario" className="self-start" pendiente="Guardando…">
                Guardar
              </BotonEnviar>
            </FormularioEstado>
          </Tarjeta>

          {d.hogar && (
            <Tarjeta
              titulo={d.hogar.nombre}
              accion={
                <Link href={`/consola/hogares/${d.hogar.id}`} className="text-sm font-semibold underline">
                  Ver hogar
                </Link>
              }
            >
              <p className="flex flex-wrap gap-2 text-sm">
                <Chip tono="info">{d.hogar.plan}</Chip>
                <Chip tono={d.hogar.estado === "activo" ? "ok" : "error"}>{d.hogar.estado}</Chip>
                <span className="text-tenue">
                  {d.hogar.miembros} {d.hogar.miembros === 1 ? "persona" : "personas"} · desde {formatearMomento(d.hogar.created_at)}
                </span>
              </p>
              <p className="mt-2 text-[13px] text-tenue">Para ver sus movimientos, pide permiso al administrador desde la ficha del hogar.</p>
            </Tarjeta>
          )}

          <Tarjeta titulo="Registro técnico" subtitulo="Errores recientes del hogar (importación, IA, correo)">
            {d.registro.length === 0 ? (
              <p className="text-sm text-tenue">Sin errores registrados.</p>
            ) : (
              <ul className="flex flex-col">
                {d.registro.map((r, i) => (
                  <li key={i} className="border-b border-divisor py-2 text-sm last:border-0">
                    <span className="flex items-center gap-2">
                      <Chip plano>{r.tipo}</Chip>
                      <span className="text-[13px] text-tenue">{formatearMomento(r.created_at)}</span>
                    </span>
                    <p className="mt-1">{r.mensaje}</p>
                    {Object.keys(r.detalle).length > 0 && (
                      <p className="mt-0.5 font-mono text-[12px] break-all text-tenue">
                        {Object.entries(r.detalle)
                          .map(([k, v]) => `${k}: ${String(v)}`)
                          .join(" · ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>

          {d.otros.length > 0 && (
            <Tarjeta titulo="Otros tickets del hogar">
              <ul className="flex flex-col gap-1 text-sm">
                {d.otros.map((o) => (
                  <li key={o.id}>
                    <Link href={`/consola/soporte/${o.id}`} className="hover:underline">
                      #{o.numero} {o.asunto}
                    </Link>{" "}
                    <span className="text-tenue">· {o.estado}</span>
                  </li>
                ))}
              </ul>
            </Tarjeta>
          )}
        </div>
      </div>
    </>
  );
}
