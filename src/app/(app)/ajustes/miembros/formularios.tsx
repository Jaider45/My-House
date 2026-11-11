"use client";

import { useActionState, useState } from "react";
import { AreaTexto, Boton, Campo, Casilla, Selector } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import { PARENTESCOS } from "@/lib/hogar/constantes";
import { guardarPersonaACargo, invitarMiembro } from "../acciones";

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
      <input readOnly value={enlace} aria-label="Enlace de la invitación" className="min-w-0 flex-1 rounded-xl border border-control bg-mosaico px-3 text-xs" onFocus={(e) => e.target.select()} />
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

export type PersonaEditable = {
  id: string;
  nombre: string;
  parentesco: string | null;
  fecha_nacimiento: string | null;
  a_cargo_de: string | null;
  nota: string | null;
  dependiente_dian: boolean;
};

/** Alta o edición de una persona a cargo (hijos, padres, pareja sin ingresos…), sin acceso a la app. */
export function FormularioPersona({ persona, adultos, hoy }: { persona?: PersonaEditable; adultos: { id: string; nombre: string }[]; hoy: string }) {
  const [estado, accion] = useActionState(guardarPersonaACargo, null);
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="id" value={persona?.id ?? ""} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombre" name="nombre" defaultValue={persona?.nombre} required maxLength={80} />
        <Selector etiqueta="Parentesco" name="parentesco" defaultValue={persona?.parentesco ?? ""}>
          <option value="">Sin especificar</option>
          {Object.entries(PARENTESCOS).map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </Selector>
        <Campo etiqueta="Fecha de nacimiento" name="fecha_nacimiento" type="date" max={hoy} defaultValue={persona?.fecha_nacimiento ?? ""} />
        <Selector etiqueta="A cargo de" name="a_cargo_de" defaultValue={persona?.a_cargo_de ?? ""}>
          <option value="">Del hogar</option>
          {adultos.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </Selector>
      </div>
      <AreaTexto
        etiqueta="Nota (opcional)"
        name="nota"
        defaultValue={persona?.nota ?? ""}
        maxLength={200}
        rows={2}
        placeholder="Ej.: estudia en la universidad, no tiene ingresos propios, tiene medicina prepagada."
      />
      <Casilla etiqueta="Lo reporto como dependiente en la declaración de renta" name="dependiente_dian" defaultChecked={persona?.dependiente_dian ?? false} />
      <MensajeEstado estado={estado} />
      <BotonEnviar variante={persona ? "primario" : "secundario"} className="w-full">
        {persona ? "Guardar cambios" : "Agregar persona a cargo"}
      </BotonEnviar>
    </form>
  );
}
