"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Aviso, Boton, Campo } from "@/components/ui";

/*
 * Llave de seguridad (WebAuthn) del equipo. La ceremonia ocurre en el navegador (navigator.credentials), así que aquí
 * se usa supabase-js del navegador, cargado solo al tocar el botón (no pesa en el resto de la consola). Supabase Auth
 * verifica la firma y deja la sesión en AAL2; la base sigue exigiendo AAL2 en cada función de la consola.
 */

async function auth() {
  const { crearClienteNavegador } = await import("@/lib/supabase/client");
  return crearClienteNavegador().auth;
}

/** Mensajes de WebAuthn en español (el navegador los da en inglés y muy técnicos). */
function explicar(e: unknown): string {
  const m = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  if (/NotAllowed|abort|cancel/i.test(m)) return "Se canceló o se acabó el tiempo. Inténtalo de nuevo y toca tu llave cuando lo pida.";
  if (/InvalidState|already registered|excludeCredentials/i.test(m)) return "Esa llave ya está registrada en tu cuenta.";
  if (/NotSupported|not supported|PublicKeyCredential/i.test(m)) return "Este navegador no permite llaves de seguridad. Prueba con Chrome, Edge, Safari o Firefox actualizados.";
  if (/SecurityError|rp ?id|origin/i.test(m)) return "La llave no se puede usar desde esta dirección. Entra por el dominio oficial de la consola.";
  return m.replace(/^Error\s*/, "") || "No se pudo usar la llave.";
}

/** Paso 2 del ingreso con la llave. `alEntrar` es una acción de servidor que registra el ingreso y entra. */
export function UsarLlave({ factorId, alEntrar }: { factorId: string; alEntrar: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <Boton
        type="button"
        className="h-12 w-full"
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            setError(null);
            try {
              const a = await auth();
              const { error: e } = await a.mfa.webauthn.authenticate({ factorId });
              if (e) throw e;
              await alEntrar();
            } catch (e) {
              setError(explicar(e));
            }
          })
        }
      >
        {pendiente ? "Esperando tu llave…" : "Usar mi llave de seguridad"}
      </Boton>
      {error && <Aviso>{error}</Aviso>}
    </div>
  );
}

/** Equipo y permisos → «Tu verificación»: registrar o quitar llaves de seguridad propias. */
export function MisLlaves({ llaves }: { llaves: { id: string; nombre: string | null }[] }) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [mensaje, setMensaje] = useState<{ ok?: string; error?: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const correr = (fn: () => Promise<string>) =>
    iniciar(async () => {
      setMensaje(null);
      try {
        setMensaje({ ok: await fn() });
        router.refresh();
      } catch (e) {
        setMensaje({ error: explicar(e) });
      }
    });

  return (
    <div className="flex flex-col gap-3">
      {llaves.length > 0 && (
        <ul className="flex flex-col">
          {llaves.map((l) => (
            <li key={l.id} className="flex min-h-10 items-center justify-between gap-3 border-b border-divisor text-sm last:border-0">
              <span>{l.nombre || "Llave de seguridad"}</span>
              <button
                type="button"
                disabled={pendiente}
                className="text-sm font-semibold text-error-tinta hover:underline disabled:opacity-50"
                onClick={() =>
                  correr(async () => {
                    const a = await auth();
                    const { error } = await a.mfa.unenroll({ factorId: l.id });
                    if (error) throw error;
                    return "Llave quitada.";
                  })
                }
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
      <Campo etiqueta="Nombre de la llave" value={nombre} onChange={(e) => setNombre(e.target.value.slice(0, 40))} placeholder="YubiKey del escritorio" />
      <Boton
        type="button"
        variante="secundario"
        disabled={pendiente}
        onClick={() =>
          correr(async () => {
            const a = await auth();
            const { error } = await a.mfa.webauthn.register({ friendlyName: nombre.trim() || `Llave ${llaves.length + 1}` });
            if (error) throw error;
            setNombre("");
            return "Llave registrada. La próxima vez puedes entrar con ella en lugar del código.";
          })
        }
      >
        {pendiente ? "Esperando tu llave…" : "Registrar una llave de seguridad"}
      </Boton>
      {mensaje?.ok && <p className="text-sm text-ok-tinta">{mensaje.ok}</p>}
      {mensaje?.error && <Aviso>{mensaje.error}</Aviso>}
    </div>
  );
}
