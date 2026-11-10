import type { Metadata } from "next";
import Link from "next/link";
import { Aviso, Chip, Tarjeta, Titulo } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import { mensajeError } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { formatearFechaCorta, formatearMomento } from "@/lib/consola/formato";
import { formatearCOP } from "@/lib/dinero";
import { hoy, sumarMeses } from "@/lib/fechas";
import { TarjetaTabla } from "../tarjeta-tabla";
import { liquidarComisiones, marcarComision, verificarContador } from "./acciones";

export const metadata: Metadata = { title: "Contadores" };

type Datos = {
  firmas: {
    id: string;
    nombre: string;
    admin: string | null;
    verificada: boolean;
    ref_codigo: string | null;
    clientes: number;
    referidos: number;
    referidos_pagando: number;
    comision_mes: number;
    created_at: string;
  }[];
  comisiones: { id: string; firma: string; firma_nombre: string; mes: string; pct: number; hogares: number; base: number; monto: number; estado: string; pagada_en: string | null }[];
};

function Indicador({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle: string }) {
  return (
    <div className="rounded-2xl border border-borde bg-elevada p-4 md:p-5">
      <p className="text-[13px] font-semibold text-cuerpo">{etiqueta}</p>
      <p className="mt-1 text-[26px] leading-8 font-bold">{valor}</p>
      <p className="text-[13px] text-tenue">{detalle}</p>
    </div>
  );
}

export default async function ContadoresConsola() {
  const staff = await obtenerStaff();
  const { data, error } = await staff.supabase.rpc("consola_contadores");
  const d = (data ?? { firmas: [], comisiones: [] }) as unknown as Datos;
  const puede = staff.puede("cobros");
  const mesPasado = sumarMeses(hoy().slice(0, 7), -1);
  const pendientes = d.comisiones.filter((c) => c.estado === "pendiente");
  const totalReferidos = d.firmas.reduce((s, f) => s + f.referidos, 0);
  const totalPagando = d.firmas.reduce((s, f) => s + f.referidos_pagando, 0);

  return (
    <>
      <Titulo registrar={false} subtitulo="Firmas con el plan Contador: traen hogares y los atienden">
        Contadores
      </Titulo>
      {error && <Aviso>{mensajeError(error)}</Aviso>}

      <section className="mb-5 grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-4">
        <Indicador etiqueta="Firmas" valor={String(d.firmas.length)} detalle={`${d.firmas.filter((f) => !f.verificada).length} sin verificar`} />
        <Indicador etiqueta="Hogares referidos" valor={totalReferidos.toLocaleString("es-CO")} detalle="todos los tiempos" />
        <Indicador etiqueta="Conversión de referidos" valor={totalReferidos ? `${Math.round((100 * totalPagando) / totalReferidos)} %` : "—"} detalle={`${totalPagando} pagando`} />
        <Indicador etiqueta="Comisiones pendientes" valor={formatearCOP(pendientes.reduce((s, c) => s + c.monto, 0))} detalle={`${pendientes.length} por pagar`} />
      </section>

      <div className="flex flex-col gap-5">
        <TarjetaTabla
          titulo="Firmas"
          subtitulo="La comisión es el % del plan sobre lo que pagan sus hogares referidos"
          accion={
            puede ? (
              <FormularioAccion accion={liquidarComisiones} className="flex items-center gap-2">
                <input type="month" name="mes" defaultValue={mesPasado} aria-label="Mes a liquidar" className="h-9 rounded-lg border border-control bg-elevada px-2 text-sm" />
                <BotonEnviar variante="secundario" className="h-9 text-sm" pendiente="Liquidando…">
                  Liquidar mes
                </BotonEnviar>
              </FormularioAccion>
            ) : undefined
          }
        >
          {d.firmas.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-tenue md:px-6">Aún no hay hogares con el plan Contador.</p>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th className="pl-4! md:pl-6!">Firma</th>
                  <th className="der">Clientes</th>
                  <th className="der">Referidos</th>
                  <th className="der">Pagando</th>
                  <th className="der">Comisión del mes</th>
                  <th>Verificación</th>
                  <th>Alta</th>
                  <th className="pr-4! md:pr-6!">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.firmas.map((f) => (
                  <tr key={f.id}>
                    <td className="pl-4! md:pl-6!">
                      <span className="flex flex-col leading-[18px]">
                        <b>{f.nombre}</b>
                        <small className="text-xs text-tenue">
                          {f.admin ?? "—"}
                          {f.ref_codigo ? ` · ref ${f.ref_codigo}` : " · sin enlace de referidos"}
                        </small>
                      </span>
                    </td>
                    <td className="der">{f.clientes}</td>
                    <td className="der">{f.referidos}</td>
                    <td className="der">{f.referidos_pagando}</td>
                    <td className="der font-bold">{formatearCOP(f.comision_mes)}</td>
                    <td>{f.verificada ? <Chip tono="ok">Verificada</Chip> : <Chip tono="alerta">Por verificar</Chip>}</td>
                    <td className="text-cuerpo">{formatearFechaCorta(f.created_at)}</td>
                    <td className="pr-4! md:pr-6!">
                      <span className="inline-flex items-center gap-2">
                        <Link href={`/consola/hogares/${f.id}`} className="text-sm font-semibold underline-offset-4 hover:underline">
                          Abrir
                        </Link>
                        {puede && (
                          <FormularioAccion accion={verificarContador} className="inline-flex">
                            <input type="hidden" name="id" value={f.id} />
                            <input type="hidden" name="verificada" value={String(!f.verificada)} />
                            <BotonEnviar variante={f.verificada ? "fantasma" : "secundario"} className="h-8 px-2 text-sm" pendiente="…">
                              {f.verificada ? "Retirar" : "Verificar"}
                            </BotonEnviar>
                          </FormularioAccion>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TarjetaTabla>

        <TarjetaTabla titulo="Comisiones" subtitulo="Liquida un mes terminado y márcalas al transferir (el pago se hace por fuera)">
          {d.comisiones.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-tenue md:px-6">Aún no hay comisiones liquidadas.</p>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th className="pl-4! md:pl-6!">Mes</th>
                  <th>Firma</th>
                  <th className="der">Hogares</th>
                  <th className="der">Pagaron</th>
                  <th className="der">Comisión</th>
                  <th>Estado</th>
                  <th className="pr-4! md:pr-6!">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.comisiones.map((c) => (
                  <tr key={c.id}>
                    <td className="pl-4! font-bold md:pl-6!">{c.mes}</td>
                    <td>{c.firma_nombre}</td>
                    <td className="der">{c.hogares}</td>
                    <td className="der">{formatearCOP(c.base)}</td>
                    <td className="der font-bold">
                      {formatearCOP(c.monto)} <span className="font-normal text-tenue">({c.pct} %)</span>
                    </td>
                    <td>{c.estado === "pagada" ? <Chip tono="ok">Pagada{c.pagada_en ? ` · ${formatearMomento(c.pagada_en)}` : ""}</Chip> : <Chip tono="alerta">Pendiente</Chip>}</td>
                    <td className="pr-4! md:pr-6!">
                      {puede && (
                        <FormularioAccion accion={marcarComision} className="inline-flex">
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="pagada" value={String(c.estado !== "pagada")} />
                          <BotonEnviar variante={c.estado === "pagada" ? "fantasma" : "secundario"} className="h-8 px-2 text-sm" pendiente="…">
                            {c.estado === "pagada" ? "Reabrir" : "Marcar pagada"}
                          </BotonEnviar>
                        </FormularioAccion>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TarjetaTabla>

        <Tarjeta titulo="Verificación de firmas">
          <p className="text-sm text-cuerpo">
            Pide la tarjeta profesional por correo antes de verificar una firma. Las firmas verificadas aparecen como «contador verificado» para sus
            clientes (pendiente de mostrar en la app del hogar).
          </p>
        </Tarjeta>
      </div>
    </>
  );
}
