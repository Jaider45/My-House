"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Barra, CuadroIcono, EnlaceBoton } from "@/components/ui";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { estaEnPaso, type Paso } from "@/lib/recorrido";
import { ocultarRecorrido, omitirPaso } from "@/app/(app)/primeros-pasos/acciones";

export type PropsBarraRecorrido = {
  resueltos: number;
  total: number;
  porcentaje: number;
  siguiente: Paso | null;
};

/**
 * Guía de configuración inicial arriba de cada pantalla: el paso que sigue y, si ya estás en su pantalla,
 * qué hacer ahí. Al terminar felicita y se cierra con un toque. No aparece en la propia página del recorrido.
 */
export function BarraRecorrido({ resueltos, total, porcentaje, siguiente }: PropsBarraRecorrido) {
  const ruta = usePathname();
  if (ruta === "/primeros-pasos") return null;
  const aqui = siguiente !== null && estaEnPaso(ruta, siguiente);

  return (
    <section aria-label="Guía de configuración" className="mb-4 rounded-2xl border border-borde bg-elevada px-4 py-3 md:px-5">
      <div className="flex flex-wrap items-center gap-3">
        <CuadroIcono nombre={siguiente?.icono ?? "casa"} />
        <div className="min-w-0 flex-[1_1_260px]">
          <p className="text-xs leading-4 font-bold tracking-[0.12em] text-cuerpo uppercase">
            {siguiente ? (
              <>
                Configura tu hogar · {resueltos} de {total}
                {aqui && " · Estás en este paso"}
              </>
            ) : (
              "Configuración completa"
            )}
          </p>
          <p className="mt-0.5 text-[15px] leading-5 font-semibold">{siguiente ? siguiente.titulo : "¡Tu hogar quedó listo!"}</p>
          <p className="mt-0.5 text-[13px] leading-[18px] text-tenue">
            {siguiente
              ? aqui
                ? siguiente.como
                : siguiente.porque
              : "Desde Inicio ves tu costo de vida y tu número mínimo. Lo que dejaste para después lo encuentras en Configuración → Primeros pasos."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {siguiente ? (
            <>
              {!aqui && <EnlaceBoton href={siguiente.href}>{siguiente.boton}</EnlaceBoton>}
              <FormularioAccion accion={omitirPaso} className="flex">
                <input type="hidden" name="paso" value={siguiente.clave} />
                <BotonEnviar variante="fantasma" pendiente="…">
                  Ahora no
                </BotonEnviar>
              </FormularioAccion>
              <Link href="/primeros-pasos" className="inline-flex h-10 items-center px-2 text-[15px] font-semibold text-cuerpo hover:text-tinta">
                Ver todos
              </Link>
            </>
          ) : (
            <FormularioAccion accion={ocultarRecorrido} className="flex">
              <BotonEnviar variante="secundario" pendiente="…">
                Cerrar
              </BotonEnviar>
            </FormularioAccion>
          )}
        </div>
      </div>
      {siguiente && (
        <div className="mt-3" aria-hidden>
          <Barra porcentaje={porcentaje} tono="marca" />
        </div>
      )}
    </section>
  );
}
