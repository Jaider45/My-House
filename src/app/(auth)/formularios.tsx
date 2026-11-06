"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Aviso, Campo } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { CampoContrasena } from "@/components/ui/campo-contrasena";
import { MensajeEstado } from "@/components/ui/estado";
import { cambiarContrasena, ingresar, pedirRecuperacion, registrarse } from "./acciones";

function conParametros(ruta: string, siguiente: string, email?: string) {
  const p = new URLSearchParams();
  if (siguiente) p.set("siguiente", siguiente);
  if (email) p.set("email", email);
  const q = p.toString();
  return q ? `${ruta}?${q}` : ruta;
}

const AVISOS: Record<string, string> = {
  confirmacion: "El enlace no es válido o ya venció. Ingresa o pide uno nuevo.",
};

/**
 * Los campos de texto son controlados: React vacía los no controlados después de cada acción, y un error de
 * contraseña no debería borrar el correo. El correo también viaja entre ingreso, registro y recuperación.
 */
function useCorreo() {
  const params = useSearchParams();
  return useState(params.get("email") ?? "");
}

export function FormularioIngreso() {
  const [estado, accion] = useActionState(ingresar, null);
  const params = useSearchParams();
  const siguiente = params.get("siguiente") ?? "";
  const [email, setEmail] = useCorreo();
  const aviso = AVISOS[params.get("error") ?? ""];
  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="siguiente" value={siguiente} />
      {aviso && !estado && <Aviso>{aviso}</Aviso>}
      <Campo
        etiqueta="Correo"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoFocus={!email}
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <div className="space-y-1.5">
        <CampoContrasena etiqueta="Contraseña" name="password" autoComplete="current-password" required autoFocus={Boolean(email)} />
        <p className="text-right">
          <Link className="text-[13px] font-semibold text-tinta underline-offset-2 hover:underline" href={conParametros("/recuperar", "", email)}>
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
      </div>
      <MensajeEstado estado={estado} />
      <BotonEnviar className="h-11 w-full" pendiente="Ingresando…">
        Ingresar
      </BotonEnviar>
      <p className="text-center text-sm text-tenue">
        ¿No tienes cuenta?{" "}
        <Link className="font-semibold text-tinta" href={conParametros("/registro", siguiente, email)}>
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
  const [email, setEmail] = useCorreo();
  const [nombre, setNombre] = useState("");
  if (estado?.ok) return <Aviso tipo="ok">{estado.ok}</Aviso>;
  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="siguiente" value={siguiente} />
      <Campo etiqueta="Tu nombre" name="nombre" autoComplete="given-name" autoFocus required maxLength={80} value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <Campo
        etiqueta="Correo"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <CampoContrasena etiqueta="Contraseña" name="password" autoComplete="new-password" required medidor />
      <MensajeEstado estado={estado} />
      <BotonEnviar className="h-11 w-full" pendiente="Creando…">
        Crear cuenta
      </BotonEnviar>
      <p className="text-center text-sm text-tenue">
        ¿Ya tienes cuenta?{" "}
        <Link className="font-semibold text-tinta" href={conParametros("/ingresar", siguiente, email)}>
          Ingresar
        </Link>
      </p>
    </form>
  );
}

export function FormularioRecuperar() {
  const [estado, accion] = useActionState(pedirRecuperacion, null);
  const [email, setEmail] = useCorreo();
  return (
    <form action={accion} className="space-y-4">
      <p className="text-sm text-cuerpo">Escribe el correo con el que ingresas y te enviamos un enlace para crear una contraseña nueva.</p>
      <Campo
        etiqueta="Correo"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoFocus
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <MensajeEstado estado={estado} />
      <BotonEnviar className="h-11 w-full" pendiente="Enviando…">
        {estado?.ok ? "Enviar de nuevo" : "Enviar enlace"}
      </BotonEnviar>
      <p className="text-center text-sm text-tenue">
        ¿La recordaste?{" "}
        <Link className="font-semibold text-tinta" href={conParametros("/ingresar", "", email)}>
          Ingresar
        </Link>
      </p>
    </form>
  );
}

/**
 * Contraseña nueva. `recuperacion`: se llega desde el enlace del correo y no se pide la actual; si no, se pide
 * (Configuración → Seguridad).
 */
export function FormularioContrasena({ recuperacion = false }: { recuperacion?: boolean }) {
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  // Tras un cambio exitoso los campos se vuelven a montar, vacíos.
  const [vuelta, setVuelta] = useState(0);
  const router = useRouter();
  // Ojo: la acción no debe hacer redirect() aquí. Envuelta así, su promesa no se resolvería y la navegación quedaría
  // pendiente para siempre; por eso navega el navegador.
  const [estado, accion] = useActionState(async (previo: Awaited<ReturnType<typeof cambiarContrasena>>, datos: FormData) => {
    const r = await cambiarContrasena(previo, datos);
    if (r?.ok && recuperacion) {
      router.replace("/");
      return r;
    }
    if (r?.ok) {
      setVuelta((v) => v + 1);
      setNueva("");
      setConfirmacion("");
    }
    return r;
  }, null);
  const noCoinciden = confirmacion.length > 0 && confirmacion !== nueva;
  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="modo" value={recuperacion ? "recuperacion" : "cambio"} />
      <div key={vuelta} className="space-y-4">
        {!recuperacion && <CampoContrasena etiqueta="Contraseña actual" name="actual" autoComplete="current-password" required minLength={1} />}
        <CampoContrasena etiqueta="Contraseña nueva" name="password" autoComplete="new-password" required medidor autoFocus={recuperacion} onCambio={setNueva} />
        <CampoContrasena etiqueta="Repite la contraseña nueva" name="confirmacion" autoComplete="new-password" required onCambio={setConfirmacion} />
      </div>
      {noCoinciden && <p className="text-[13px] font-semibold text-error-tinta">Las dos contraseñas no coinciden todavía.</p>}
      <MensajeEstado estado={estado} />
      <BotonEnviar className={recuperacion ? "h-11 w-full" : undefined} pendiente="Guardando…" disabled={noCoinciden}>
        {recuperacion ? "Guardar y entrar" : "Cambiar contraseña"}
      </BotonEnviar>
    </form>
  );
}
