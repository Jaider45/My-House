import { redirect } from "next/navigation";
import { Barra, Chip, CuadroIcono, EnlaceBoton, Tarjeta, Titulo, cx } from "@/components/ui";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { cargarRecorrido } from "@/lib/recorrido/servidor";
import type { EstadoPaso } from "@/lib/recorrido";
import { mostrarRecorrido, ocultarRecorrido, omitirPaso, retomarPaso } from "./acciones";

export const metadata = { title: "Primeros pasos" };

export default async function PrimerosPasos() {
  const r = await cargarRecorrido(true);
  if (!r) redirect("/"); // solo lectura: no hay nada que configurar

  return (
    <>
      <Titulo subtitulo="Lo mínimo para que My House calcule tu costo de vida y te avise a tiempo" registrar={false}>
        Primeros pasos
      </Titulo>
      <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-4 md:gap-5 lg:order-2">
          <Tarjeta>
            <p className="text-xs leading-4 font-bold tracking-[0.12em] text-cuerpo uppercase">Tu avance</p>
            <p className="mt-2 text-[28px] leading-[34px] font-bold">
              {r.resueltos} de {r.total}
            </p>
            <div className="mt-3">
              <Barra porcentaje={r.porcentaje} tono="marca" gruesa />
            </div>
            <p className="mt-3 text-sm text-cuerpo">
              {r.completo
                ? "¡Tu hogar quedó configurado! Desde Inicio ves el costo de vida, el número mínimo y lo que falta por pagar."
                : `Siguiente: ${r.siguiente?.titulo.toLowerCase()}. Cada paso toma un par de minutos y puedes dejar alguno para después.`}
            </p>
            {r.siguiente && (
              <EnlaceBoton href={r.siguiente.href} className="mt-4 w-full">
                {r.siguiente.boton}
              </EnlaceBoton>
            )}
          </Tarjeta>
          <Tarjeta>
            <p className="text-sm text-cuerpo">
              {r.oculto
                ? "La guía está oculta en las demás pantallas. Puedes volver a mostrarla cuando quieras."
                : "La barra de la guía te acompaña arriba de cada pantalla hasta que termines."}
            </p>
            <FormularioAccion accion={r.oculto ? mostrarRecorrido : ocultarRecorrido} className="mt-3 flex">
              <BotonEnviar variante="secundario" className="w-full">
                {r.oculto ? "Mostrar la guía" : "Ocultar la guía"}
              </BotonEnviar>
            </FormularioAccion>
          </Tarjeta>
        </div>

        <Tarjeta className="lg:order-1 lg:col-span-2" titulo="Configura tu hogar" subtitulo="En este orden, cada paso aprovecha el anterior">
          <ol className="flex flex-col">
            {r.pasos.map((p, i) => (
              <FilaPaso key={p.clave} paso={p} numero={i + 1} actual={r.siguiente?.clave === p.clave} />
            ))}
          </ol>
        </Tarjeta>
      </div>
    </>
  );
}

function FilaPaso({ paso: p, numero, actual }: { paso: EstadoPaso; numero: number; actual: boolean }) {
  return (
    <li className={cx("flex flex-wrap items-start gap-3 border-b border-divisor py-4 last:border-b-0", actual && "-mx-2 rounded-xl bg-seleccion px-2")}>
      <CuadroIcono nombre={p.icono} tamano={40} />
      <div className="min-w-0 flex-[1_1_240px]">
        <p className="flex flex-wrap items-center gap-2 text-[15px] leading-5 font-semibold">
          <span className="text-tenue">{numero}.</span>
          <span className={cx(p.hecho && "text-cuerpo line-through decoration-1")}>{p.titulo}</span>
          {p.hecho ? <Chip tono="ok">Hecho</Chip> : p.omitido ? <Chip>Omitido</Chip> : p.opcional && <Chip plano>Opcional</Chip>}
        </p>
        <p className="mt-1 text-[13px] leading-[18px] text-tenue">{p.porque}</p>
        {actual && <p className="mt-2 text-[13px] leading-[18px] text-cuerpo">{p.como}</p>}
      </div>
      {!p.hecho && (
        <div className="flex w-full flex-wrap items-center gap-2 pl-[52px] sm:w-auto sm:pl-0">
          {p.omitido ? (
            <FormularioAccion accion={retomarPaso} className="flex">
              <input type="hidden" name="paso" value={p.clave} />
              <BotonEnviar variante="fantasma">Retomar</BotonEnviar>
            </FormularioAccion>
          ) : (
            <>
              <EnlaceBoton href={p.href} variante={actual ? "primario" : "secundario"}>
                {p.boton}
              </EnlaceBoton>
              <FormularioAccion accion={omitirPaso} className="flex">
                <input type="hidden" name="paso" value={p.clave} />
                <BotonEnviar variante="fantasma">Ahora no</BotonEnviar>
              </FormularioAccion>
            </>
          )}
        </div>
      )}
    </li>
  );
}
