"use client";

import { useActionState, useState } from "react";
import { claseControl, cx, Tarjeta } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import { cantidadVariables, VARIABLES_CAMPANA } from "@/lib/whatsapp/usos";
import { guardarCanal } from "../editor-acciones";

export type PlantillaCampana = { id: string; nombre: string; categoria: string; cuerpo: string };

/**
 * Canal de la campaña. Por WhatsApp sale una plantilla aprobada por Meta (marketing, en el horario de Ajustes) solo a
 * quienes dejaron su celular y autorizaron WhatsApp, dentro de la misma audiencia del correo.
 */
export function CanalCampana({ id, canal, plantilla, vars, plantillas }: { id: string; canal: string; plantilla: string | null; vars: string[]; plantillas: PlantillaCampana[] }) {
  const [estado, enviar] = useActionState(guardarCanal, null);
  const [elegido, setElegido] = useState(canal);
  const [pl, setPl] = useState(plantilla ?? "");
  const p = plantillas.find((x) => x.id === pl);
  const n = p ? cantidadVariables(p.cuerpo) : 0;
  return (
    <Tarjeta titulo="Canal" subtitulo="Correo con el diseño de arriba, o una plantilla de WhatsApp aprobada">
      <form action={enviar} className="flex flex-col gap-3 text-sm">
        <input type="hidden" name="id" value={id} />
        <div className="flex gap-4">
          {[
            ["correo", "Correo"],
            ["whatsapp", "WhatsApp"],
          ].map(([v, t]) => (
            <label key={v} className="inline-flex items-center gap-2">
              <input type="radio" name="canal" value={v} checked={elegido === v} onChange={() => setElegido(v)} className="size-4 accent-monte" />
              {t}
            </label>
          ))}
        </div>
        {elegido === "whatsapp" && (
          <>
            {plantillas.length === 0 ? (
              <p className="text-tenue">No hay plantillas aprobadas. Créalas en Plantillas de WhatsApp y espera la aprobación de Meta.</p>
            ) : (
              <select name="plantilla" value={pl} onChange={(e) => setPl(e.target.value)} aria-label="Plantilla" className={cx(claseControl, "h-10")}>
                <option value="">Elige una plantilla aprobada</option>
                {plantillas.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nombre}
                    {x.categoria === "MARKETING" ? "" : " · utilidad"}
                  </option>
                ))}
              </select>
            )}
            {p && <p className="rounded-lg bg-mosaico px-3 py-2 text-[13px] whitespace-pre-line text-cuerpo">{p.cuerpo}</p>}
            {Array.from({ length: n }, (_, i) => (
              <label key={`${pl}-${i}`} className="flex items-center justify-between gap-2">
                <span className="text-cuerpo">{`{{${i + 1}}}`}</span>
                <select name="var" defaultValue={pl === plantilla ? (vars[i] ?? "nombre") : (VARIABLES_CAMPANA[i]?.clave ?? "nombre")} className={cx(claseControl, "h-9 w-[220px]")}>
                  {VARIABLES_CAMPANA.map((v) => (
                    <option key={v.clave} value={v.clave}>
                      {v.texto}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <p className="text-[13px] text-tenue">Solo la reciben quienes autorizaron WhatsApp con su celular. Las de marketing respetan el horario de envío.</p>
          </>
        )}
        <MensajeEstado estado={estado} />
        <BotonEnviar variante="secundario" className="self-start" pendiente="Guardando…">
          Guardar canal
        </BotonEnviar>
      </form>
    </Tarjeta>
  );
}
