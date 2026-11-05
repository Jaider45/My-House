"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Campo } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import { ingresar, registrarse } from "./acciones";

function conSiguiente(ruta: string, siguiente: string) {
  return siguiente ? `${ruta}?siguiente=${encodeURIComponent(siguiente)}` : ruta;
}

export function FormularioIngreso() {
  const [estado, accion] = useActionState(ingresar, null);
  const params = useSearchParams();
  const siguiente = params.get("siguiente") ?? "";
  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="siguiente" value={siguiente} />
      <Campo etiqueta="Correo" name="email" type="email" autoComplete="email" required defaultValue={params.get("email") ?? ""} />
      <Campo etiqueta="Contraseña" name="password" type="password" autoComplete="current-password" required minLength={8} />
      <MensajeEstado estado={estado} />
      <BotonEnviar className="w-full" pendiente="Ingresando…">
        Ingresar
      </BotonEnviar>
      <p className="text-center text-sm text-tenue">
        ¿No tienes cuenta?{" "}
        <Link className="font-semibold text-tinta" href={conSiguiente("/registro", siguiente)}>
          Crear cuenta
        </Link>
      </p>
    </form>
  );
}

export function FormularioRegistro() {
  const [estado, accion] = useActionState(registrarse, null);
  const params = useSearchParams();
  const siguiente = params.get("siguiente") ?? "";
  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="siguiente" value={siguiente} />
      <Campo etiqueta="Tu nombre" name="nombre" autoComplete="given-name" required maxLength={80} />
      <Campo etiqueta="Correo" name="email" type="email" autoComplete="email" required defaultValue={params.get("email") ?? ""} />
      <Campo
        etiqueta="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        ayuda="Mínimo 8 caracteres."
      />
      <MensajeEstado estado={estado} />
      <BotonEnviar className="w-full" pendiente="Creando…">
        Crear cuenta
      </BotonEnviar>
      <p className="text-center text-sm text-tenue">
        ¿Ya tiene cuenta?{" "}
        <Link className="font-semibold text-tinta" href={conSiguiente("/ingresar", siguiente)}>
          Ingresar
        </Link>
      </p>
    </form>
  );
}
