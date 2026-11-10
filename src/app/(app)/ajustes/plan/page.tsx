import type { Metadata } from "next";
import { Aviso, Barra, Chip, Tarjeta, Titulo, type Tono } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import { cargarMiPlan } from "@/lib/planes/servidor";
import { diasDePrueba, porcentajeUso, textoLimite } from "@/lib/planes";
import { configWompi } from "@/lib/pagos/wompi";
import { consultarTransaccion } from "@/lib/pagos/servidor";
import { formatearCOP } from "@/lib/dinero";
import { formatearFechaCorta, formatearMomento } from "@/lib/consola/formato";
import { PestanasConfiguracion } from "../pestanas";
import { cambiarRenovacion, pagarPendiente } from "./acciones";
import { ElegirPlan } from "./elegir";

export const metadata: Metadata = { title: "Plan" };

const ESTADO_COBRO: Record<string, { texto: string; tono: Tono }> = {
  pagado: { texto: "Pagado", tono: "ok" },
  pendiente: { texto: "Pendiente", tono: "alerta" },
  fallido: { texto: "Rechazado", tono: "error" },
  anulado: { texto: "Anulado", tono: "neutro" },
  reembolsado: { texto: "Reembolsado", tono: "info" },
};

const dia = (f: string | null | undefined) => formatearFechaCorta(f ? `${f}T12:00:00-05:00` : null);

function Uso({ etiqueta, usado, tope, texto }: { etiqueta: string; usado: number; tope: number | null | undefined; texto: string }) {
  const pct = porcentajeUso(usado, tope);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between gap-3 text-sm">
        <span className="text-cuerpo">{etiqueta}</span>
        <b>{texto}</b>
      </div>
      {pct !== null && <Barra porcentaje={pct} tono={pct >= 100 ? "error" : pct >= 80 ? "alerta" : "marca"} />}
    </div>
  );
}

/** Resultado del Web Checkout: Wompi vuelve con `?id=<transacción>`. El plan lo activa el webhook. */
async function Resultado({ id }: { id: string }) {
  const wompi = configWompi();
  const t = wompi ? await consultarTransaccion(id, wompi.publica) : null;
  if (!t) return null;
  if (t.status === "APPROVED") return <Aviso tipo="ok">Recibimos tu pago de {formatearCOP(t.amount_in_cents / 100)}. Tu plan se actualiza en unos segundos (te llega un correo).</Aviso>;
  if (t.status === "PENDING") return <Aviso tipo="info">Tu pago está en proceso. Te avisamos por correo cuando se confirme.</Aviso>;
  return <Aviso>El pago no se completó{t.status_message ? `: ${t.status_message}` : "."} Puedes intentarlo de nuevo.</Aviso>;
}

export default async function PlanHogar({ searchParams }: PageProps<"/ajustes/plan">) {
  const { ctx, estado, planes, actual, limites, pruebaDias, descuentoAnualVisible } = await cargarMiPlan();
  const sp = await searchParams;
  const [{ data: sus }, { data: cobros }] = await Promise.all([
    ctx.supabase.from("suscripciones").select("plan, periodo, estado, vence, monto_periodo, cancelar_al_vencer").eq("household_id", ctx.hogar.id).maybeSingle(),
    ctx.esAdmin
      ? ctx.supabase.from("cobros").select("id, creado, plan, periodo, motivo, monto, cupon, estado, metodo, metodo_detalle, referencia").eq("household_id", ctx.hogar.id).order("creado", { ascending: false }).limit(12)
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const pendiente = cobros?.find((c) => c.estado === "pendiente");
  const enPrueba = estado.plan === "gratis" && diasDePrueba(estado.prueba_hasta) > 0;
  const nombrePlan = (c: string) => planes.find((p) => p.codigo === c)?.nombre ?? c;
  const chip: { texto: string; tono: Tono } =
    estado.estado === "suspendido"
      ? { texto: "Suspendido", tono: "error" }
      : sus?.estado === "vencida"
        ? { texto: "Pago pendiente", tono: "error" }
        : enPrueba
          ? { texto: `Prueba · ${diasDePrueba(estado.prueba_hasta)} días`, tono: "info" }
          : { texto: "Activo", tono: "ok" };

  return (
    <>
      <Titulo subtitulo="Lo que incluye tu plan, cuánto has usado y tus pagos">Configuración</Titulo>
      <PestanasConfiguracion actual="/ajustes/plan" />
      <div className="flex flex-col gap-5">
        {typeof sp.id === "string" && <Resultado id={sp.id} />}

        <Tarjeta titulo={`Plan ${actual?.nombre ?? nombrePlan(estado.efectivo)}`} accion={<Chip tono={chip.tono}>{chip.texto}</Chip>}>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-3 text-sm">
              {enPrueba && <p>Tu prueba de Familia termina el {formatearFechaCorta(estado.prueba_hasta)}. Después sigues en Gratis, sin cobros automáticos.</p>}
              {sus && sus.estado !== "cancelada" && (
                <p>
                  {formatearCOP(sus.monto_periodo)} {sus.periodo === "anual" ? "al año" : "al mes"} ·{" "}
                  {sus.cancelar_al_vencer ? `termina el ${dia(sus.vence)}` : sus.estado === "vencida" ? `venció el ${dia(sus.vence)}` : `se renueva el ${dia(sus.vence)}`}
                </p>
              )}
              {!sus && !enPrueba && estado.efectivo === "gratis" && <p className="text-cuerpo">Estás en el plan Gratis. Mejora cuando quieras: tus datos se quedan.</p>}
              {pendiente && (
                <div className="flex flex-col gap-2 rounded-xl bg-alerta-fondo p-3 text-alerta-tinta">
                  <span>
                    {pendiente.motivo === "renovacion" ? "Renovación pendiente" : "Pago sin terminar"}: <b>{formatearCOP(pendiente.monto)}</b> por el plan {nombrePlan(pendiente.plan)} {pendiente.periodo}.
                  </span>
                  <FormularioAccion accion={pagarPendiente} className="flex">
                    <BotonEnviar className="h-10" pendiente="Abriendo el pago…">
                      Pagar {formatearCOP(pendiente.monto)}
                    </BotonEnviar>
                  </FormularioAccion>
                </div>
              )}
              {ctx.esAdmin && sus?.estado === "activa" && (
                <FormularioAccion accion={cambiarRenovacion} className="flex">
                  <input type="hidden" name="renovar" value={sus.cancelar_al_vencer ? "si" : "no"} />
                  <BotonEnviar variante="fantasma" className="h-9 px-0! text-sm underline-offset-4 hover:underline" pendiente="…">
                    {sus.cancelar_al_vencer ? "Seguir renovando" : "No renovar al vencer"}
                  </BotonEnviar>
                </FormularioAccion>
              )}
            </div>
            <div className="flex flex-col gap-4">
              <Uso etiqueta="Personas con acceso" usado={estado.uso.personas} tope={limites.personas} texto={`${estado.uso.personas} de ${textoLimite("personas", limites.personas)}`} />
              <Uso
                etiqueta="Comprobantes con IA este mes"
                usado={estado.uso.comprobantes_mes}
                tope={limites.comprobantes_mes}
                texto={limites.comprobantes_mes == null ? `${estado.uso.comprobantes_mes} · ilimitados` : `${estado.uso.comprobantes_mes} de ${limites.comprobantes_mes}`}
              />
              <Uso
                etiqueta="Soportes guardados"
                usado={Number(estado.uso.almacenamiento_mb)}
                tope={limites.almacenamiento_mb}
                texto={`${textoLimite("almacenamiento_mb", Math.round(Number(estado.uso.almacenamiento_mb)))} de ${textoLimite("almacenamiento_mb", limites.almacenamiento_mb)}`}
              />
            </div>
          </div>
        </Tarjeta>

        <ElegirPlan
          planes={planes}
          efectivo={estado.efectivo}
          suscripcion={sus ? { plan: sus.plan, periodo: sus.periodo, estado: sus.estado } : null}
          esAdmin={ctx.esAdmin}
          pagosActivos={configWompi() !== null}
          pruebaDisponible={!estado.prueba_usada && estado.plan === "gratis"}
          pruebaDias={pruebaDias}
          descuentoAnualVisible={descuentoAnualVisible}
        />

        {ctx.esAdmin && (cobros?.length ?? 0) > 0 && (
          <section className="overflow-hidden rounded-2xl border border-borde bg-elevada pb-2">
            <div className="px-4 pt-4 md:px-6 md:pt-5">
              <h2 className="text-[17px] leading-[22px] font-bold md:text-xl md:leading-[26px]">Pagos</h2>
              <p className="mt-0.5 text-sm text-tenue">Los últimos 12</p>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="tabla">
                <thead>
                  <tr>
                    <th className="pl-4! md:pl-6!">Fecha</th>
                    <th>Concepto</th>
                    <th className="der">Valor</th>
                    <th>Medio</th>
                    <th className="pr-4! md:pr-6!">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {cobros!.map((c) => (
                    <tr key={c.id}>
                      <td className="pl-4! text-cuerpo md:pl-6!">{formatearMomento(c.creado)}</td>
                      <td>
                        {nombrePlan(c.plan)} {c.periodo}
                        {c.cupon && <span className="text-tenue"> · {c.cupon}</span>}
                      </td>
                      <td className="der font-semibold">{formatearCOP(c.monto)}</td>
                      <td className="text-cuerpo">{[c.metodo, c.metodo_detalle].filter(Boolean).join(" ") || "—"}</td>
                      <td className="pr-4! md:pr-6!">
                        <Chip tono={ESTADO_COBRO[c.estado]?.tono}>{ESTADO_COBRO[c.estado]?.texto ?? c.estado}</Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
