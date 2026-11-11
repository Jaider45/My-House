"use client";

import { useActionState, useState } from "react";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import { responderTicketConsola } from "./acciones";

/** Respuesta o nota interna, con respuestas guardadas que llenan el texto (que vive aquí: no se pierde si falla). */
export function ResponderTicket({ id, respuestas, nombre }: { id: string; respuestas: { id: string; titulo: string; cuerpo: string }[]; nombre: string }) {
  const [texto, setTexto] = useState("");
  const [interno, setInterno] = useState(false);
  const [estado, enviar] = useActionState(async (e: Parameters<typeof responderTicketConsola>[0], d: FormData) => {
    const r = await responderTicketConsola(e, d);
    if (r?.ok) setTexto("");
    return r;
  }, null);

  return (
    <form action={enviar} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={id} />
      {respuestas.length > 0 && (
        <select
          aria-label="Respuesta guardada"
          defaultValue=""
          onChange={(e) => {
            const r = respuestas.find((x) => x.id === e.target.value);
            if (r) setTexto(r.cuerpo.replaceAll("{nombre}", nombre));
            e.target.value = "";
          }}
          className="h-9 rounded-lg border border-control bg-elevada px-2 text-sm"
        >
          <option value="">Usar una respuesta guardada…</option>
          {respuestas.map((r) => (
            <option key={r.id} value={r.id}>
              {r.titulo}
            </option>
          ))}
        </select>
      )}
      <textarea
        name="cuerpo"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={5}
        maxLength={5000}
        aria-label={interno ? "Nota interna" : "Respuesta"}
        placeholder={interno ? "Solo la ve el equipo" : `Hola ${nombre}, …`}
        className={`rounded-lg border px-3 py-2 text-[15px] outline-none focus:border-monte ${interno ? "border-alerta bg-alerta-fondo" : "border-control bg-elevada"}`}
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" name="interno" checked={interno} onChange={(e) => setInterno(e.target.checked)} className="size-4 accent-monte" />
          Nota interna
        </label>
        {!interno && (
          <select name="estado" defaultValue="esperando_cliente" aria-label="Dejar el ticket" className="h-9 rounded-lg border border-control bg-elevada px-2 text-sm">
            <option value="esperando_cliente">y esperar respuesta</option>
            <option value="resuelto">y dar por resuelto</option>
            <option value="abierto">y dejar abierto</option>
          </select>
        )}
        <BotonEnviar pendiente="Enviando…">{interno ? "Guardar nota" : "Responder"}</BotonEnviar>
      </div>
      <MensajeEstado estado={estado} />
    </form>
  );
}
