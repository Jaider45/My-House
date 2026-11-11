import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AreaTexto, Chip, Tarjeta, Titulo, cx } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioEstado } from "@/components/ui/formulario-estado";
import { obtenerContexto } from "@/lib/sesion";
import { formatearMomento } from "@/lib/consola/formato";
import { responderTicket } from "../acciones";
import { ESTADO_TICKET } from "../estados";

export const metadata: Metadata = { title: "Solicitud de ayuda" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Conversacion({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await obtenerContexto();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [{ data: t }, { data: mensajes }] = await Promise.all([
    ctx.supabase.from("tickets").select("id, numero, asunto, estado, created_at").eq("id", id).maybeSingle(),
    ctx.supabase.from("ticket_mensajes").select("id, autor_nombre, de_equipo, cuerpo, created_at").eq("ticket_id", id).order("id"),
  ]);
  if (!t) notFound();
  const estado = ESTADO_TICKET[t.estado];

  return (
    <>
      <Titulo registrar={false} subtitulo={`Solicitud #${t.numero} · ${formatearMomento(t.created_at)}`} accion={<Chip tono={estado.tono}>{estado.texto}</Chip>}>
        {t.asunto}
      </Titulo>
      <div className="flex max-w-3xl flex-col gap-4">
        <ol className="flex flex-col gap-3">
          {(mensajes ?? []).map((m) => (
            <li key={m.id} className={cx("max-w-[85%] rounded-2xl px-4 py-3", m.de_equipo ? "self-start border border-borde bg-elevada" : "self-end bg-seleccion")}>
              <p className="mb-1 text-[13px] font-semibold text-cuerpo">
                {m.de_equipo ? `${m.autor_nombre} · equipo de My House` : "Tú"} · <span className="font-normal text-tenue">{formatearMomento(m.created_at)}</span>
              </p>
              <p className="text-[15px] whitespace-pre-line">{m.cuerpo}</p>
            </li>
          ))}
        </ol>
        <Tarjeta>
          <FormularioEstado accion={responderTicket} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={t.id} />
            <AreaTexto etiqueta={t.estado === "resuelto" ? "¿Sigue pasando? Escribe y la reabrimos" : "Responder"} name="cuerpo" rows={4} maxLength={5000} />
            <div className="flex flex-wrap gap-2">
              <BotonEnviar name="cerrar" value="0" pendiente="Enviando…">
                Enviar
              </BotonEnviar>
              {t.estado !== "resuelto" && (
                <BotonEnviar name="cerrar" value="1" variante="fantasma" pendiente="…">
                  Ya se resolvió, cerrar
                </BotonEnviar>
              )}
            </div>
          </FormularioEstado>
        </Tarjeta>
        <Link href="/ayuda" className="text-sm font-semibold underline">
          Volver a Ayuda
        </Link>
      </div>
    </>
  );
}

export default function SolicitudAyuda({ params }: PageProps<"/ayuda/[id]">) {
  return <Conversacion params={params} />;
}
