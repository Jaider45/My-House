"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Aviso, Campo, cx } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { CampoContrasena } from "@/components/ui/campo-contrasena";
import { Captcha } from "@/components/ui/captcha";
import { MensajeEstado } from "@/components/ui/estado";
import { cambiarContrasena, ingresar, ingresarConGoogle, pedirCodigo, pedirRecuperacion, registrarse, verificarCodigo } from "./acciones";

const GOOGLE_ACTIVO = process.env.NEXT_PUBLIC_GOOGLE_ACTIVO === "1";

function conParametros(ruta: string, siguiente: string, email?: string) {
  const p = new URLSearchParams();
  if (siguiente) p.set("siguiente", siguiente);
  if (email) p.set("email", email);
  const q = p.toString();
  return q ? `${ruta}?${q}` : ruta;
}

const AVISOS: Record<string, string> = {
  confirmacion: "El enlace no es válido o ya venció. Ingresa o pide uno nuevo.",
  google: "No se pudo abrir el ingreso con Google. Intenta de nuevo o entra con tu correo.",
};

/**
 * Los campos de texto son controlados: React vacía los no controlados después de cada acción, y un error de
 * contraseña no debería borrar el correo. El correo también viaja entre ingreso, registro y recuperación.
 */
function useCorreo() {
  const params = useSearchParams();
  return useState(params.get("email") ?? "");
}

const claseEnlace = "font-semibold text-tinta underline-offset-2 hover:underline";

/** «Continuar con Google». Solo si el proveedor está activo en este despliegue. */
function BotonGoogle({ siguiente }: { siguiente: string }) {
  if (!GOOGLE_ACTIVO) return null;
  return (
      <form action={ingresarConGoogle}>
        <input type="hidden" name="siguiente" value={siguiente} />
        <BotonEnviar variante="secundario" className="h-11 w-full" pendiente="Abriendo Google…">
          <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden>
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
            <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
            <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
            <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
          </svg>
          Continuar con Google
        </BotonEnviar>
      </form>
  );
}

/** Línea con un texto al centro: separa la forma principal de entrar de las demás. */
function Separador({ texto }: { texto: string }) {
  return (
    <p className="flex items-center gap-3 text-[13px] text-tenue before:h-px before:flex-1 before:bg-borde after:h-px after:flex-1 after:bg-borde">
      {texto}
    </p>
  );
}

/** Google y el separador, arriba del registro. */
function BloqueGoogle({ siguiente }: { siguiente: string }) {
  if (!GOOGLE_ACTIVO) return null;
  return (
    <>
      <BotonGoogle siguiente={siguiente} />
      <Separador texto="o con tu correo" />
    </>
  );
}

const claseSecundario =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-cuerpo bg-elevada px-4 text-[15px] font-semibold text-tinta transition hover:bg-mosaico";

/** Íconos de línea con el trazo de la marca para los botones secundarios del ingreso. */
function IconoSobre() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  );
}
function IconoCandado() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function FormularioIngreso() {
  const params = useSearchParams();
  const siguiente = params.get("siguiente") ?? "";
  const [email, setEmail] = useCorreo();
  const [modo, setModo] = useState<"clave" | "codigo">("clave");
  const aviso = AVISOS[params.get("error") ?? ""];
  return (
    <div className="space-y-4">
      {aviso && <Aviso>{aviso}</Aviso>}
      {modo === "clave" ? (
        <IngresoConClave email={email} setEmail={setEmail} siguiente={siguiente} />
      ) : (
        <IngresoConCodigo email={email} setEmail={setEmail} siguiente={siguiente} />
      )}
      <Separador texto="o" />
      <div className="space-y-3">
        {modo === "clave" ? (
          <button type="button" className={claseSecundario} onClick={() => setModo("codigo")}>
            <IconoSobre />
            Recibir un código por correo
          </button>
        ) : (
          <button type="button" className={claseSecundario} onClick={() => setModo("clave")}>
            <IconoCandado />
            Entrar con contraseña
          </button>
        )}
        <BotonGoogle siguiente={siguiente} />
      </div>
      <p className="pt-2 text-center text-sm text-tenue">
        ¿Primera vez?{" "}
        <Link className={cx(claseEnlace, "underline")} href={conParametros("/registro", siguiente, email)}>
          Crea tu hogar
        </Link>
      </p>
      <p className="text-center text-xs text-tenue">Tus datos viajan cifrados. My House nunca te pide la clave de tu banco.</p>
    </div>
  );
}

type PropsCorreo = { email: string; setEmail: (v: string) => void; siguiente: string };

function CampoCorreo({ email, setEmail, autoFocus, autoComplete = "username" }: Pick<PropsCorreo, "email" | "setEmail"> & { autoFocus?: boolean; autoComplete?: string }) {
  return (
    <Campo
      etiqueta="Correo"
      name="email"
      type="email"
      inputMode="email"
      autoComplete={autoComplete}
      autoFocus={autoFocus}
      required
      value={email}
      onChange={(e) => setEmail(e.target.value)}
    />
  );
}

function IngresoConClave({ email, setEmail, siguiente }: PropsCorreo) {
  const [estado, accion] = useActionState(ingresar, null);
  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="siguiente" value={siguiente} />
      <CampoCorreo email={email} setEmail={setEmail} autoFocus={!email} />
      <CampoContrasena
        etiqueta="Contraseña"
        name="password"
        autoComplete="current-password"
        required
        autoFocus={Boolean(email)}
        accesorio={
          <Link className={cx(claseEnlace, "text-[13px] underline")} href={conParametros("/recuperar", "", email)}>
            ¿La olvidaste?
          </Link>
        }
      />
      <Captcha reinicio={estado} />
      <MensajeEstado estado={estado} />
      <BotonEnviar className="h-11 w-full" pendiente="Ingresando…">
        Ingresar
      </BotonEnviar>
    </form>
  );
}

/** Código de 6 dígitos: acepta «123 456» pegado y se envía solo al completarse. */
function CampoCodigo({ etiqueta = "Código", autoFocus = true }: { etiqueta?: string; autoFocus?: boolean }) {
  const [codigo, setCodigo] = useState("");
  const campo = useRef<HTMLInputElement>(null);
  return (
    <Campo
      ref={campo}
      etiqueta={etiqueta}
      name="codigo"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="\d{6}"
      required
      autoFocus={autoFocus}
      value={codigo}
      onChange={(e) => {
        const limpio = e.target.value.replace(/\D/g, "").slice(0, 6);
        setCodigo(limpio);
        if (limpio.length === 6) queueMicrotask(() => campo.current?.form?.requestSubmit());
      }}
      className="[&_input]:text-center [&_input]:text-[22px] [&_input]:font-semibold [&_input]:tracking-[0.4em]"
    />
  );
}

function IngresoConCodigo({ email, setEmail, siguiente }: PropsCorreo) {
  const [pedido, pedir] = useActionState(pedirCodigo, null);
  const [verificado, verificar] = useActionState(verificarCodigo, null);
  // En el paso del código mientras el correo siga siendo aquel al que se envió.
  const enCodigo = Boolean(pedido?.enviado) && pedido?.email === email.trim().toLowerCase();

  if (!enCodigo) {
    return (
      <form action={pedir} className="space-y-4">
        <p className="text-sm text-cuerpo">Te enviamos un código de 6 dígitos a tu correo para entrar sin contraseña.</p>
        <CampoCorreo email={email} setEmail={setEmail} autoFocus />
        <Captcha reinicio={pedido} />
        <MensajeEstado estado={pedido} />
        <BotonEnviar className="h-11 w-full" pendiente="Enviando…">
          Enviarme un código
        </BotonEnviar>
      </form>
    );
  }

  const estado = verificado ?? pedido;
  return (
    <form action={verificar} className="space-y-4">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="siguiente" value={siguiente} />
      <MensajeEstado estado={estado} />
      <CampoCodigo etiqueta="Código del correo" key={String(verificado?.error)} />
      <Captcha reinicio={pedido} />
      <BotonEnviar className="h-11 w-full" pendiente="Verificando…">
        Entrar
      </BotonEnviar>
      <p className="flex flex-wrap justify-between gap-2 text-[13px]">
        <button type="button" className={claseEnlace} onClick={() => setEmail("")}>
          Usar otro correo
        </button>
        <button type="submit" formAction={pedir} formNoValidate className={claseEnlace}>
          Enviar otro código
        </button>
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
    <div className="space-y-4">
      <BloqueGoogle siguiente={siguiente || "/onboarding"} />
      <form action={accion} className="space-y-4">
        <input type="hidden" name="siguiente" value={siguiente} />
        <Campo etiqueta="Tu nombre" name="nombre" autoComplete="given-name" autoFocus required maxLength={80} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <CampoCorreo email={email} setEmail={setEmail} autoComplete="email" />
        <CampoContrasena etiqueta="Contraseña" name="password" autoComplete="new-password" required medidor />
        <Captcha reinicio={estado} />
        <MensajeEstado estado={estado} />
        <BotonEnviar className="h-11 w-full" pendiente="Creando…">
          Crear cuenta
        </BotonEnviar>
        <p className="text-center text-sm text-tenue">
          ¿Ya tienes cuenta?{" "}
          <Link className={claseEnlace} href={conParametros("/ingresar", siguiente, email)}>
            Ingresar
          </Link>
        </p>
      </form>
    </div>
  );
}

export function FormularioRecuperar() {
  const [estado, accion] = useActionState(pedirRecuperacion, null);
  const [email, setEmail] = useCorreo();
  return (
    <form action={accion} className="space-y-4">
      <p className="text-sm text-cuerpo">Escribe el correo con el que ingresas y te enviamos un enlace para crear una contraseña nueva.</p>
      <CampoCorreo email={email} setEmail={setEmail} autoFocus autoComplete="email" />
      <Captcha reinicio={estado} />
      <MensajeEstado estado={estado} />
      <BotonEnviar className="h-11 w-full" pendiente="Enviando…">
        {estado?.ok ? "Enviar de nuevo" : "Enviar enlace"}
      </BotonEnviar>
      <p className="text-center text-sm text-tenue">
        ¿La recordaste?{" "}
        <Link className={claseEnlace} href={conParametros("/ingresar", "", email)}>
          Ingresar
        </Link>
      </p>
    </form>
  );
}

/**
 * Contraseña nueva. `recuperacion`: se llega desde el enlace del correo y al guardar se entra a Inicio.
 * `pideActual`: Configuración la pide, salvo que la sesión se haya abierto hace poco con un enlace o código al correo.
 */
export function FormularioContrasena({ recuperacion = false, pideActual = !recuperacion }: { recuperacion?: boolean; pideActual?: boolean }) {
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
        {pideActual && <CampoContrasena etiqueta="Contraseña actual" name="actual" autoComplete="current-password" required minLength={1} />}
        <CampoContrasena etiqueta="Contraseña nueva" name="password" autoComplete="new-password" required medidor autoFocus={recuperacion} onCambio={setNueva} />
        <CampoContrasena etiqueta="Repite la contraseña nueva" name="confirmacion" autoComplete="new-password" required onCambio={setConfirmacion} />
      </div>
      {noCoinciden && <p className="text-[13px] font-semibold text-error-tinta">Las dos contraseñas no coinciden todavía.</p>}
      <label className="flex items-start gap-2.5 text-sm text-cuerpo">
        <input type="checkbox" name="cerrar_otras" defaultChecked className="mt-0.5 size-4 accent-monte" />
        <span>
          Cerrar sesión en mis otros dispositivos
          <span className="block text-[13px] text-tenue">Recomendado si alguien más pudo conocer tu contraseña.</span>
        </span>
      </label>
      <MensajeEstado estado={estado} />
      <BotonEnviar className={recuperacion ? "h-11 w-full" : undefined} pendiente="Guardando…" disabled={noCoinciden}>
        {recuperacion ? "Guardar y entrar" : "Cambiar contraseña"}
      </BotonEnviar>
    </form>
  );
}
