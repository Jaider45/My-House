"use client";

import { useActionState, useState } from "react";
import type { Estado } from "@/lib/acciones";
import { MensajeEstado } from "@/components/ui/estado";
import { cx } from "@/components/ui";

/** «¿Te sirvió esta lección?» con 1 a 5 estrellas (se guarda al tocar). */
export function Calificar({ clave, accion }: { clave: string; accion: (e: Estado, d: FormData) => Promise<Estado> }) {
  const [estado, enviar, pendiente] = useActionState(accion, null);
  const [elegida, setElegida] = useState(0);
  return (
    <form action={enviar} className="flex flex-col gap-1 rounded-2xl border border-borde bg-elevada px-5 py-4">
      <input type="hidden" name="clave" value={clave} />
      <span className="text-sm font-semibold">¿Te sirvió esta lección?</span>
      <span className="flex gap-1" role="radiogroup" aria-label="Calificación">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="submit"
            name="estrellas"
            value={n}
            role="radio"
            aria-checked={elegida === n}
            aria-label={`${n} de 5`}
            disabled={pendiente}
            onClick={() => setElegida(n)}
            className={cx("text-2xl leading-none transition", n <= elegida ? "text-teja" : "text-control hover:text-teja/70")}
          >
            ★
          </button>
        ))}
      </span>
      <MensajeEstado estado={estado} />
    </form>
  );
}
