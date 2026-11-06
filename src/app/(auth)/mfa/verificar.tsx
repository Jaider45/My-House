"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Aviso, Boton, Campo } from "@/components/ui";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { mensajeError } from "@/lib/acciones";
import { destinoSeguro } from "@/lib/rutas";
import { cerrarSesion } from "../acciones";

export function VerificarMfa() {
  const router = useRouter();
  const siguiente = destinoSeguro(useSearchParams().get("siguiente"));
  const [error, setError] = useState<string>();
  const [codigo, setCodigo] = useState("");
  const [pendiente, iniciar] = useTransition();
  const formulario = useRef<HTMLFormElement>(null);

  function verificar(datos: FormData) {
    const code = String(datos.get("codigo") ?? "").replace(/\D/g, "");
    setError(undefined);
    iniciar(async () => {
      const supabase = crearClienteNavegador();
      const { data: factores } = await supabase.auth.mfa.listFactors();
      const factor = factores?.totp.find((f) => f.status === "verified");
      if (!factor) {
        setError("No hay un autenticador configurado.");
        return;
      }
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (error) {
        setError(mensajeError(error));
        setCodigo("");
        return;
      }
      router.replace(siguiente);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <form ref={formulario} action={verificar} className="space-y-4">
        <p className="text-sm text-tenue">Escribe el código de 6 dígitos de tu app autenticadora.</p>
        <Campo
          etiqueta="Código"
          name="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          required
          autoFocus
          value={codigo}
          // Acepta "123 456" pegado; con los 6 dígitos se envía solo.
          onChange={(e) => {
            const limpio = e.target.value.replace(/\D/g, "").slice(0, 6);
            setCodigo(limpio);
            if (limpio.length === 6 && !pendiente) queueMicrotask(() => formulario.current?.requestSubmit());
          }}
          className="[&_input]:text-center [&_input]:text-[22px] [&_input]:font-semibold [&_input]:tracking-[0.4em]"
        />
        {error && <Aviso>{error}</Aviso>}
        <Boton type="submit" className="h-11 w-full" disabled={pendiente || codigo.length < 6}>
          {pendiente ? "Verificando…" : "Verificar"}
        </Boton>
      </form>
      <form action={cerrarSesion}>
        <Boton type="submit" variante="secundario" className="w-full">
          Cerrar sesión
        </Boton>
      </form>
    </div>
  );
}
