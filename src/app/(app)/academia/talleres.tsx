"use client";

import { useActionState } from "react";
import { clasesBoton } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import { inscribirTaller } from "./acciones";

export type Taller = { id: string; titulo: string; descripcion: string; fecha: string; cupos: number; inscritos: number; inscrito: boolean; enlace: string | null };

const fechaTaller = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" }).format(new Date(iso));

function Inscripcion({ t }: { t: Taller }) {
  const [estado, enviar] = useActionState(inscribirTaller, null);
  const lleno = t.inscritos >= t.cupos && !t.inscrito;
  return (
    <form action={enviar} className="flex flex-col items-start gap-2">
      <input type="hidden" name="id" value={t.id} />
      <input type="hidden" name="inscribir" value={t.inscrito ? "0" : "1"} />
      <span className="flex flex-wrap items-center gap-2">
        {t.inscrito && t.enlace && (
          <a href={t.enlace} target="_blank" rel="noreferrer" className={clasesBoton("primario", "h-9 px-3 text-sm")}>
            Entrar a la sesión
          </a>
        )}
        <BotonEnviar variante={t.inscrito ? "fantasma" : "primario"} disabled={lleno} className="h-9 px-3 text-sm" pendiente="…">
          {t.inscrito ? "Cancelar inscripción" : lleno ? "Sin cupos" : "Inscribirme"}
        </BotonEnviar>
      </span>
      <MensajeEstado estado={estado} />
    </form>
  );
}

/** Talleres en vivo (Consola → Academia → Talleres): cupos e inscripción; el enlace solo para inscritos. */
export function Talleres({ talleres }: { talleres: Taller[] }) {
  if (!talleres.length) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-bold">Talleres en vivo</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {talleres.map((t) => (
          <article key={t.id} className="flex flex-col gap-2 rounded-[18px] border border-borde bg-elevada p-5">
            <span className="text-xs font-bold tracking-[0.04em] text-cuerpo uppercase">
              {fechaTaller(t.fecha)} · {Math.max(0, t.cupos - t.inscritos)} cupos libres
            </span>
            <b className="text-[17px] leading-[23px]">{t.titulo}</b>
            {t.descripcion && <p className="text-sm text-cuerpo">{t.descripcion}</p>}
            <Inscripcion t={t} />
          </article>
        ))}
      </div>
    </section>
  );
}
