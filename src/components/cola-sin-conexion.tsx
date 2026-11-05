"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { registrarRapido } from "@/app/(app)/movimientos/acciones";
import { esErrorDeRed, leerCola, marcarError, porEnviar, quitarDeCola, type Pendiente } from "@/lib/cola";
import { formatearCOP, digitosAMonto } from "@/lib/dinero";

export const EVENTO_COLA = "myhouse:cola";

/**
 * Envía los registros rápidos que se hicieron sin conexión cuando vuelve la señal (y al abrir la app),
 * y muestra cuántos esperan. Los que el servidor rechaza quedan a la vista para descartarlos.
 */
export function ColaSinConexion() {
  const router = useRouter();
  const [cola, setCola] = useState<Pendiente[]>([]);
  const [enLinea, setEnLinea] = useState(true);
  const enviando = useRef(false);

  const refrescar = useCallback(() => setCola(leerCola(localStorage)), []);

  const enviar = useCallback(async () => {
    if (enviando.current || !navigator.onLine) return;
    enviando.current = true;
    let enviados = 0;
    try {
      for (const p of porEnviar(leerCola(localStorage))) {
        const datos = new FormData();
        for (const [k, v] of Object.entries(p.campos)) datos.set(k, v);
        try {
          const r = await registrarRapido(null, datos);
          if (r?.ok) {
            quitarDeCola(localStorage, p.id);
            enviados++;
          } else {
            marcarError(localStorage, p.id, r?.error ?? "El servidor no lo aceptó.");
          }
        } catch (e) {
          if (esErrorDeRed(e)) break; // se cayó otra vez la señal: se reintenta en el próximo «online»
          marcarError(localStorage, p.id, "No se pudo enviar.");
        }
      }
    } finally {
      enviando.current = false;
      refrescar();
      if (enviados) router.refresh();
    }
  }, [refrescar, router]);

  useEffect(() => {
    const alCambiar = () => {
      setEnLinea(navigator.onLine);
      if (navigator.onLine) void enviar();
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage y navigator solo existen en el cliente
    refrescar();
    alCambiar();
    window.addEventListener("online", alCambiar);
    window.addEventListener("offline", alCambiar);
    window.addEventListener(EVENTO_COLA, alCambiar);
    return () => {
      window.removeEventListener("online", alCambiar);
      window.removeEventListener("offline", alCambiar);
      window.removeEventListener(EVENTO_COLA, alCambiar);
    };
  }, [enviar, refrescar]);

  const esperando = porEnviar(cola);
  const rechazados = cola.filter((p) => p.error);
  if (!cola.length && enLinea) return null;

  return (
    <div role="status" className="mb-4 space-y-2 rounded-xl bg-alerta-fondo px-4 py-3 text-sm text-alerta-tinta">
      {!enLinea && <p className="font-semibold">Sin conexión. Puedes seguir registrando gastos: se envían solos al volver la señal.</p>}
      {esperando.length > 0 && (
        <p>
          {esperando.length === 1 ? "1 registro espera" : `${esperando.length} registros esperan`} conexión para guardarse (
          {formatearCOP(esperando.reduce((s, p) => s + digitosAMonto(p.campos.monto ?? ""), 0))}).
        </p>
      )}
      {rechazados.map((p) => (
        <p key={p.id} className="flex flex-wrap items-center justify-between gap-2">
          <span>
            {formatearCOP(digitosAMonto(p.campos.monto ?? ""))} del {p.campos.fecha}: {p.error}
          </span>
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => {
              quitarDeCola(localStorage, p.id);
              refrescar();
            }}
          >
            Descartar
          </button>
        </p>
      ))}
    </div>
  );
}
