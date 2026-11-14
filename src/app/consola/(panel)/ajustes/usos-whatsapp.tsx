"use client";

import { useState } from "react";
import { claseControl, cx } from "@/components/ui";
import { cantidadVariables, USOS, type UsosWhatsapp } from "@/lib/whatsapp/usos";

export type PlantillaAprobada = { nombre: string; categoria: string; cuerpo: string };

/**
 * Ajustes → Envíos → «Plantillas por uso»: qué plantilla aprobada sale en cada aviso automático y qué dato va en
 * cada {{n}}. Al elegir la plantilla aparecen tantos selectores como variables tenga su cuerpo.
 */
export function UsosWhatsapp({ usos, plantillas, puede }: { usos: UsosWhatsapp; plantillas: PlantillaAprobada[]; puede: boolean }) {
  return (
    <div className="flex flex-col">
      {USOS.map((u) => (
        <Uso key={u.clave} uso={u} actual={usos[u.clave]} plantillas={plantillas} puede={puede} />
      ))}
      {plantillas.length === 0 && <p className="pt-2 text-[13px] text-tenue">Aún no hay plantillas aprobadas por Meta. Créalas en Plantillas de WhatsApp.</p>}
    </div>
  );
}

function Uso({ uso, actual, plantillas, puede }: { uso: (typeof USOS)[number]; actual?: { plantilla: string; variables: string[] }; plantillas: PlantillaAprobada[]; puede: boolean }) {
  const [elegida, setElegida] = useState(actual?.plantilla ?? "");
  const p = plantillas.find((x) => x.nombre === elegida);
  const n = p ? cantidadVariables(p.cuerpo) : 0;
  return (
    <div className="flex flex-col gap-2 border-b border-divisor py-3 text-sm last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span>
          <b className="block">{uso.nombre}</b>
          <span className="text-[13px] text-tenue">{uso.cuando}</span>
        </span>
        <select
          name={`${uso.clave}_plantilla`}
          value={elegida}
          onChange={(e) => setElegida(e.target.value)}
          disabled={!puede}
          aria-label={`Plantilla para ${uso.nombre}`}
          className={cx(claseControl, "h-9 w-full md:w-[260px]")}
        >
          <option value="">No enviar por WhatsApp</option>
          {plantillas.map((x) => (
            <option key={x.nombre} value={x.nombre}>
              {x.nombre}
            </option>
          ))}
        </select>
      </div>
      {p && (
        <>
          <p className="rounded-lg bg-mosaico px-3 py-2 text-[13px] whitespace-pre-line text-cuerpo">{p.cuerpo}</p>
          {Array.from({ length: n }, (_, i) => (
            <label key={i} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-cuerpo">{`{{${i + 1}}}`}</span>
              <select
                name={`${uso.clave}_var`}
                defaultValue={actual?.plantilla === elegida ? (actual.variables[i] ?? uso.disponibles[i]?.clave) : uso.disponibles[i]?.clave}
                disabled={!puede}
                className={cx(claseControl, "h-9 w-full md:w-[260px]")}
              >
                {uso.disponibles.map((v) => (
                  <option key={v.clave} value={v.clave}>
                    {v.texto}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </>
      )}
    </div>
  );
}
