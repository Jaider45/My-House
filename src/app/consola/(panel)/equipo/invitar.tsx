"use client";

import { useActionState, useState } from "react";
import { Boton, Campo, Selector } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import { ROLES_STAFF } from "@/lib/consola/permisos";
import { invitarPersona } from "./acciones";

/** Invitar persona: correo, nombre y rol. Muestra el enlace para compartirlo aunque el correo no salga. */
export function FormularioInvitar() {
  const [estado, enviar] = useActionState(invitarPersona, null);
  return (
    <form action={enviar} className="flex flex-col gap-3.5" key={estado?.enlace}>
      <Campo etiqueta="Correo" name="email" type="email" autoComplete="off" required />
      <Campo etiqueta="Nombre" name="nombre" autoComplete="off" required maxLength={80} />
      <Selector etiqueta="Rol" name="rol" defaultValue="soporte" required>
        {ROLES_STAFF.map((r) => (
          <option key={r.valor} value={r.valor}>
            {r.nombre}
          </option>
        ))}
      </Selector>
      <MensajeEstado estado={estado} />
      {estado?.enlace && <CopiarEnlace key={estado.enlace} enlace={estado.enlace} />}
      <BotonEnviar pendiente="Invitando…">Invitar persona</BotonEnviar>
    </form>
  );
}

function CopiarEnlace({ enlace }: { enlace: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input readOnly value={enlace} aria-label="Enlace de la invitación" className="h-9 min-w-0 flex-1 rounded-lg border border-control bg-pagina px-2 text-xs text-cuerpo" />
      <Boton type="button" variante="secundario" className="h-9 px-3 text-sm" onClick={() => navigator.clipboard.writeText(enlace).then(() => setCopiado(true))}>
        {copiado ? "Copiado" : "Copiar"}
      </Boton>
    </div>
  );
}
