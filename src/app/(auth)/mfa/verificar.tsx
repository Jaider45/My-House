"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Aviso, Boton, Campo } from "@/components/ui";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { mensajeError } from "@/lib/acciones";
import { cerrarSesion } from "../acciones";

export function VerificarMfa() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pendiente, iniciar] = useTransition();

  function verificar(datos: FormData) {
    const code = String(datos.get("codigo") ?? "").replace(/\D/g, "");
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
        return;
      }
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <form action={verificar} className="space-y-4">
        <p className="text-sm text-zinc-500">Escriba el código de 6 dígitos de su app autenticadora.</p>
        <Campo
          etiqueta="Código"
          name="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
        />
        {error && <Aviso>{error}</Aviso>}
        <Boton type="submit" className="w-full" disabled={pendiente}>
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
