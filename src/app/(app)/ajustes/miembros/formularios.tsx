"use client";

import { useActionState, useState } from "react";
import { AreaTexto, Boton, Campo, Casilla, Selector } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import { PieVentana } from "@/components/ui/ventana";
import { PARENTESCOS } from "@/lib/hogar/constantes";
import { guardarPersonaACargo, invitarMiembro } from "../acciones";

const ROLES_INVITACION = [
  { valor: "editor", titulo: "Pareja", texto: "Registra, edita y aprueba pagos" },
  { valor: "contador", titulo: "Contador · solo lectura", texto: "Ve movimientos, Renta DIAN y soportes. No edita ni ve la configuración." },
  { valor: "familiar", titulo: "Familiar", texto: "Solo registra gastos" },
  { valor: "admin", titulo: "Administrador", texto: "Además invita y quita personas y cambia la configuración" },
] as const;

/**
 * Invitación (ventana «Invitar a alguien al hogar»). No se cierra al crearla: muestra el enlace para compartirlo
 * por WhatsApp o copiarlo (el correo sale solo si hay por dónde enviarlo).
 */
export function FormularioInvitar() {
  const [estado, accion] = useActionState(invitarMiembro, null);
  const [rol, setRol] = useState<string>("editor");
  return (
    <form action={accion} className="flex flex-col gap-4">
      <Campo etiqueta="Correo o celular" name="destino" placeholder="nombre@correo.com o 300 123 4567" autoComplete="off" required />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[13px] leading-[18px] font-semibold text-cuerpo">Rol</legend>
        {ROLES_INVITACION.map((r) => (
          <label
            key={r.valor}
            className={`flex cursor-pointer items-start gap-3 rounded-xl px-3.5 py-3 ${rol === r.valor ? "border-2 border-monte bg-seleccion" : "border border-control"}`}
          >
            <input type="radio" name="rol" value={r.valor} checked={rol === r.valor} onChange={() => setRol(r.valor)} className="mt-1 size-[18px] accent-monte" />
            <span>
              <b className="block text-[15px]">{r.titulo}</b>
              <span className="text-sm text-cuerpo">{r.texto}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <MensajeEstado estado={estado} />
      {estado?.enlace && <CopiarEnlace enlace={estado.enlace} />}
      {estado?.whatsapp && (
        <a
          href={estado.whatsapp}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center justify-center self-start rounded-[10px] border border-cuerpo px-4 text-[15px] font-semibold hover:bg-mosaico"
        >
          Enviar el enlace por WhatsApp
        </a>
      )}
      <PieVentana pendiente="Creando…">{estado?.enlace ? "Crear otra invitación" : "Enviar invitación"}</PieVentana>
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
