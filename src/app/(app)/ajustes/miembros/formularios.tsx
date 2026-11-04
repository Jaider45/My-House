"use client";

import { useActionState, useState } from "react";
import { Boton, Campo, Selector } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import { agregarDependiente, invitarMiembro } from "../acciones";

export function FormularioInvitar() {
  const [estado, accion] = useActionState(invitarMiembro, null);
  return (
    <form action={accion} className="space-y-3">
      <Campo etiqueta="Correo de la persona" name="email" type="email" required />
      <Selector etiqueta="Rol" name="rol" defaultValue="editor">
        <option value="editor">Editor: registra y edita movimientos</option>
        <option value="admin">Administrador: además gestiona miembros</option>
        <option value="contador">Contador: solo lectura</option>
      </Selector>
      <MensajeEstado estado={estado} />
      {estado?.enlace && <CopiarEnlace enlace={estado.enlace} />}
      <BotonEnviar className="w-full" pendiente="Creando…">
        Crear invitación
      </BotonEnviar>
    </form>
  );
}

export function CopiarEnlace({ enlace }: { enlace: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="flex gap-2">
      <input readOnly value={enlace} className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-zinc-50 px-3 text-xs dark:border-zinc-700 dark:bg-zinc-800" onFocus={(e) => e.target.select()} />
      <Boton
        type="button"
        variante="secundario"
        onClick={async () => {
          if (navigator.share) {
            await navigator.share({ title: "Invitación a My House", url: enlace }).catch(() => {});
          } else {
            await navigator.clipboard.writeText(enlace);
            setCopiado(true);
          }
        }}
      >
        {copiado ? "Copiado" : "Compartir"}
      </Boton>
    </div>
  );
}

export function FormularioDependiente() {
  const [estado, accion] = useActionState(agregarDependiente, null);
  return (
    <form action={accion} className="space-y-3">
      <Campo etiqueta="Nombre" name="nombre" required maxLength={80} ayuda="Hijos u otras personas a cargo, sin acceso a la app." />
      <MensajeEstado estado={estado} />
      <BotonEnviar variante="secundario" className="w-full">
        Agregar dependiente
      </BotonEnviar>
    </form>
  );
}
