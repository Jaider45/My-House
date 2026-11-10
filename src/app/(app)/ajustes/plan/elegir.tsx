"use client";

import { useActionState, useState, useTransition } from "react";
import { Aviso, Boton, Chip, cx } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import { formatearCOP } from "@/lib/dinero";
import { ahorroAnual, LIMITES, textoLimite, type Plan } from "@/lib/planes";
import { cotizar, iniciarPrueba, pagar, type Cotizacion } from "./acciones";

type Props = {
  planes: Plan[];
  efectivo: string;
  suscripcion: { plan: string; periodo: string; estado: string } | null;
  esAdmin: boolean;
  pagosActivos: boolean;
  pruebaDisponible: boolean;
  pruebaDias: number;
  descuentoAnualVisible: boolean;
};

/** Tarjetas de planes con pago mensual o anual, cupón y botón de pago (o prueba de Familia). */
export function ElegirPlan(p: Props) {
  const [periodo, setPeriodo] = useState<"mensual" | "anual">((p.suscripcion?.periodo as "mensual" | "anual") ?? "mensual");
  const pagos = p.planes.filter((x) => x.precio_mensual > 0);
  const ahorro = pagos[0] ? ahorroAnual(pagos[0].precio_mensual, pagos[0].precio_anual) : null;

  return (
    <div className="flex flex-col gap-4">
      {pagos.length > 0 && (
        <div role="radiogroup" aria-label="Forma de pago" className="inline-flex self-start rounded-full border border-control bg-elevada p-1">
          {(["mensual", "anual"] as const).map((x) => (
            <button
              key={x}
              type="button"
              role="radio"
              aria-checked={periodo === x}
              onClick={() => setPeriodo(x)}
              className={cx("h-9 rounded-full px-4 text-sm font-semibold", periodo === x ? "bg-monte text-arena" : "text-tinta")}
            >
              {x === "mensual" ? "Mensual" : "Anual"}
              {x === "anual" && p.descuentoAnualVisible && ahorro && ahorro.meses > 0 && (
                <span className={cx("ml-1.5 text-xs", periodo === x ? "text-arena" : "text-ok-tinta")}>{ahorro.meses} meses gratis</span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {p.planes.map((plan) => {
          const actual = plan.codigo === p.efectivo;
          const precio = periodo === "anual" ? plan.precio_anual : plan.precio_mensual;
          return (
            <section
              key={plan.codigo}
              className={cx("flex flex-col gap-4 rounded-2xl border bg-elevada p-5 md:p-6", actual ? "border-monte shadow-[inset_0_0_0_1px_var(--color-monte)]" : "border-borde")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl leading-[26px] font-bold">{plan.nombre}</h3>
                  <p className="text-sm text-cuerpo">{plan.descripcion}</p>
                </div>
                {actual && <Chip tono="ok">Tu plan</Chip>}
              </div>
              <p>
                <span className="text-[28px] leading-[34px] font-bold">{precio === 0 ? "$ 0" : formatearCOP(precio)}</span>
                {precio > 0 && <span className="text-sm text-cuerpo"> / {periodo === "anual" ? "año" : "mes"}</span>}
              </p>
              <ul className="flex flex-col text-sm">
                {LIMITES.filter((l) => l.para !== "contador").map((l) => {
                  const v = plan.limites[l.clave];
                  const no = v === false;
                  return (
                    <li key={l.clave} className="flex min-h-9 items-center justify-between gap-3 border-b border-divisor last:border-0">
                      <span className={no ? "text-tenue" : "text-cuerpo"}>{l.texto}</span>
                      <b className={no ? "font-normal text-tenue" : undefined}>{l.tipo === "si_no" ? (v ? "Sí" : "—") : textoLimite(l.clave, v)}</b>
                    </li>
                  );
                })}
              </ul>
              {plan.precio_mensual > 0 && <Acciones {...p} plan={plan} periodo={periodo} actual={actual} />}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Acciones({ plan, periodo, actual, suscripcion, esAdmin, pagosActivos, pruebaDisponible, pruebaDias }: Props & { plan: Plan; periodo: "mensual" | "anual"; actual: boolean }) {
  const [estado, enviar] = useActionState(pagar, null);
  const [cupon, setCupon] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState<Cotizacion | null>(null);
  const [cotizando, iniciar] = useTransition();
  const mismo = suscripcion?.estado === "activa" && suscripcion.plan === plan.codigo && suscripcion.periodo === periodo;
  const precio = periodo === "anual" ? plan.precio_anual : plan.precio_mensual;
  const conCupon = q && !q.error && q.cupon ? q : null;

  if (!esAdmin) return <p className="text-sm text-tenue">Solo un administrador del hogar puede cambiar el plan.</p>;
  if (mismo) return <p className="text-sm text-cuerpo">Ya pagas este plan. La renovación aparece arriba cuando se acerque.</p>;

  return (
    <div className="mt-auto flex flex-col gap-3">
      <form action={enviar} className="flex flex-col gap-3">
        <input type="hidden" name="plan" value={plan.codigo} />
        <input type="hidden" name="periodo" value={periodo} />
        <input type="hidden" name="cupon" value={conCupon?.cupon ?? ""} />
        {abierto ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-cuerpo" htmlFor={`cupon-${plan.codigo}`}>
              Cupón
            </label>
            <div className="flex gap-2">
              <input
                id={`cupon-${plan.codigo}`}
                value={cupon}
                onChange={(e) => {
                  setCupon(e.target.value.toUpperCase());
                  setQ(null);
                }}
                autoCapitalize="characters"
                className="h-10 min-w-0 flex-1 rounded-lg border border-control bg-elevada px-3 text-[15px] uppercase"
              />
              <Boton
                type="button"
                variante="secundario"
                disabled={!cupon || cotizando}
                onClick={() => iniciar(async () => setQ(await cotizar(plan.codigo, periodo, cupon)))}
              >
                {cotizando ? "…" : "Aplicar"}
              </Boton>
            </div>
            {q?.error && <span className="text-[13px] font-semibold text-error-tinta">{q.error}</span>}
            {conCupon && (
              <span className="text-[13px] font-semibold text-ok-tinta">
                {conCupon.cupon_descripcion || conCupon.cupon}: pagas {formatearCOP(conCupon.monto ?? 0)} en lugar de {formatearCOP(conCupon.precio ?? precio)}.
              </span>
            )}
          </div>
        ) : (
          <button type="button" onClick={() => setAbierto(true)} className="self-start text-sm font-semibold underline-offset-4 hover:underline">
            ¿Tienes un cupón?
          </button>
        )}
        <MensajeEstado estado={estado} />
        {!pagosActivos && !conCupon && <Aviso tipo="info">Los pagos estarán disponibles muy pronto.</Aviso>}
        <BotonEnviar className="h-11 w-full" pendiente="Abriendo el pago…" disabled={!pagosActivos && !(conCupon && conCupon.monto === 0)}>
          {conCupon?.monto === 0 ? "Activar con el cupón" : `Pagar ${formatearCOP(conCupon?.monto ?? precio)}`}
        </BotonEnviar>
        {pagosActivos && <p className="text-center text-xs text-tenue">Tarjeta, PSE, Nequi, Daviplata o Bancolombia, con Wompi.</p>}
      </form>
      {pruebaDisponible && !actual && (
        <FormularioAccion accion={iniciarPrueba} className="flex flex-col">
          <BotonEnviar variante="secundario" className="h-11 w-full" pendiente="Activando…">
            Probar {pruebaDias} días gratis
          </BotonEnviar>
        </FormularioAccion>
      )}
    </div>
  );
}
