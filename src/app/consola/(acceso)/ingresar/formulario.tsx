"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { Aviso, Boton, Campo } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { CampoContrasena } from "@/components/ui/campo-contrasena";
import { Captcha } from "@/components/ui/captcha";
import { ingresarConsola, salirConsola, verificarConsola } from "./acciones";

function Encabezado({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div>
      <h1 className="text-[28px] leading-[34px] font-bold">{titulo}</h1>
      <p className="mt-1.5 text-[15px] leading-[22px] text-cuerpo">{texto}</p>
    </div>
  );
}

export function IngresoClave({ siguiente, inactividad }: { siguiente: string; inactividad: boolean }) {
  const [estado, enviar] = useActionState(ingresarConsola, null);
  return (
    <form action={enviar} className="flex flex-col gap-[18px]">
      <Encabezado titulo="Ingresa a la consola" texto="Usa tu cuenta del equipo de My House. Después te pediremos el código de dos pasos." />
      {inactividad && !estado && <Aviso tipo="info">Cerramos tu sesión tras 30 minutos sin actividad. Ingresa de nuevo.</Aviso>}
      <input type="hidden" name="siguiente" value={siguiente} />
      <Campo etiqueta="Correo del equipo" name="email" type="email" autoComplete="username" required autoFocus />
      <CampoContrasena etiqueta="Contraseña" name="password" autoComplete="current-password" required minLength={1} />
      <Captcha reinicio={estado} />
      {estado?.error && <Aviso>{estado.error}</Aviso>}
      <BotonEnviar className="h-12 w-full" pendiente="Ingresando…">
        Continuar
      </BotonEnviar>
    </form>
  );
}

/** Código de 6 dígitos: acepta «123 456» pegado y se envía solo al completar. */
export function IngresoCodigo({ email, siguiente }: { email: string; siguiente: string }) {
  const [estado, enviar, pendiente] = useActionState(verificarConsola, null);
  const [codigo, setCodigo] = useState("");
  const formulario = useRef<HTMLFormElement>(null);
  return (
    <div className="flex flex-col gap-[18px]">
      <form ref={formulario} action={enviar} className="flex flex-col gap-[18px]">
        <Encabezado titulo="Verifica que eres tú" texto="Contraseña correcta. Escribe el código de 6 dígitos de tu app autenticadora." />
        <input type="hidden" name="siguiente" value={siguiente} />
        <Campo etiqueta="Correo del equipo" value={email} readOnly tabIndex={-1} />
        <Campo
          etiqueta="Código de verificación"
          name="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          required
          autoFocus
          value={codigo}
          onChange={(e) => {
            const limpio = e.target.value.replace(/\D/g, "").slice(0, 6);
            setCodigo(limpio);
            if (limpio.length === 6 && !pendiente) queueMicrotask(() => formulario.current?.requestSubmit());
          }}
          className="[&_input]:h-14 [&_input]:text-center [&_input]:text-[24px] [&_input]:font-semibold [&_input]:tracking-[0.5em]"
        />
        {estado?.error && <Aviso>{estado.error}</Aviso>}
        <Boton type="submit" className="h-12 w-full" disabled={pendiente || codigo.length < 6}>
          {pendiente ? "Verificando…" : "Entrar a la consola"}
        </Boton>
      </form>
      <form action={salirConsola} className="self-center">
        <Boton type="submit" variante="fantasma" className="h-9 text-sm">
          Usar otra cuenta
        </Boton>
      </form>
    </div>
  );
}

export function FueraDelEquipo({ email }: { email: string }) {
  return (
    <div className="flex flex-col gap-[18px]">
      <Encabezado titulo="Esta cuenta no es del equipo" texto={`Ingresaste como ${email}. La consola es solo para el equipo de My House.`} />
      <form action={salirConsola}>
        <Boton type="submit" className="h-12 w-full">
          Ingresar con otra cuenta
        </Boton>
      </form>
      <Link href="/" className="self-center text-sm font-semibold text-tinta underline-offset-4 hover:underline">
        Ir a mi hogar
      </Link>
    </div>
  );
}
