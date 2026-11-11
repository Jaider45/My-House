import type { Metadata } from "next";
import { Chip, Tarjeta, Titulo, Vacio, type Tono } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import { MejoraPlan } from "@/components/mejora-plan";
import { obtenerContexto } from "@/lib/sesion";
import { cargarParametros, cargarSemaforo } from "@/lib/impuestos/servidor";
import { formatearCOP } from "@/lib/dinero";
import { formatearFecha, hoy } from "@/lib/fechas";
import { sitio } from "@/lib/correo/enviar";
import { cambiarHogar } from "../hogar-activo";
import { crearEnlaceReferido } from "./acciones";

export const metadata: Metadata = { title: "Clientes" };

type Cliente = { id: string; nombre: string; pais: string; admin_nombre: string | null; miembros: number; movimientos_30d: number; ultimo_movimiento: string | null };
type Firma = {
  id: string;
  nombre: string;
  ref_codigo: string | null;
  verificada: boolean;
  limites: { hogares?: number | null; comision_pct?: number | null };
  clientes: number;
  referidos: number;
  referidos_pagando: number;
  comisiones: { mes: string; monto: number; hogares: number; estado: string }[];
};

const SEMAFORO: Record<string, { texto: string; tono: Tono }> = {
  verde: { texto: "Al día", tono: "ok" },
  amarillo: { texto: "Cerca de un tope", tono: "alerta" },
  rojo: { texto: "Debe declarar", tono: "error" },
};

async function Contenido() {
  const ctx = await obtenerContexto(); // antes de hoy(): marca el render como dinámico
  const anio = Number(hoy().slice(0, 4));
  const [{ data: clientes }, { data: firmaCruda }] = await Promise.all([ctx.supabase.rpc("mis_clientes"), ctx.supabase.rpc("mi_firma")]);
  const lista = (clientes ?? []) as Cliente[];
  const firma = firmaCruda as Firma | null;

  // Semáforo DIAN de cada cliente (es la razón de ser del panel): solo con plan Contador, hasta su tope de hogares.
  const semaforos = new Map<string, { texto: string; tono: Tono }>();
  if (firma) {
    const visibles = lista.slice(0, firma.limites.hogares ?? 30);
    // Los parámetros del año se leen una vez por país y se reusan en todos los clientes (no uno por hogar).
    const paises = [...new Set(visibles.map((c) => c.pais))];
    const params = new Map(await Promise.all(paises.map(async (p) => [p, await cargarParametros(ctx, p, anio)] as const)));
    const estados = await Promise.all(
      visibles.map(async (c) => {
        const s = await cargarSemaforo({ ...ctx, hogar: { ...ctx.hogar, id: c.id, pais: c.pais } }, anio, params.get(c.pais) ?? null);
        if (!s.ok || !s.personas.length) return [c.id, { texto: "Sin datos", tono: "neutro" as Tono }] as const;
        const peor = s.personas.some((p) => p.estado === "rojo") ? "rojo" : s.personas.some((p) => p.estado === "amarillo") ? "amarillo" : "verde";
        return [c.id, SEMAFORO[peor]] as const;
      }),
    );
    for (const [id, estado] of estados) semaforos.set(id, estado);
  }

  if (!lista.length && !firma) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Vacio icono="certificados" titulo="Aún no tienes clientes">
          Cuando un hogar te invite como contador (Configuración → Miembros, rol Contador), aparece aquí con su semáforo de renta.
        </Vacio>
        <MejoraPlan titulo="Panel de clientes con el plan Contador">
          Todos tus hogares clientes en una pantalla, tu enlace de referidos y el 20 % de comisión por cada hogar que pague.
        </MejoraPlan>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
      <section className="min-w-0 overflow-hidden rounded-2xl border border-borde bg-elevada pb-2">
        <div className="px-4 pt-4 md:px-6 md:pt-5">
          <h2 className="text-[17px] leading-[22px] font-bold md:text-xl md:leading-[26px]">Tus clientes</h2>
          <p className="mt-0.5 text-sm text-tenue">
            {lista.length} {lista.length === 1 ? "hogar" : "hogares"} donde eres contador{firma?.limites.hogares ? ` · hasta ${firma.limites.hogares} con tu plan` : ""}
          </p>
        </div>
        <div className="mt-3 overflow-x-auto">
          {lista.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-tenue md:px-6">Comparte tu enlace de referido o pide que te inviten como contador.</p>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th className="pl-4! md:pl-6!">Hogar</th>
                  <th className="der">Mov. 30 d</th>
                  <th>Último registro</th>
                  {firma && <th>Renta {anio}</th>}
                  <th className="pr-4! md:pr-6!">
                    <span className="sr-only">Abrir</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => (
                  <tr key={c.id}>
                    <td className="pl-4! md:pl-6!">
                      <span className="flex flex-col leading-[18px]">
                        <b>{c.nombre}</b>
                        <small className="text-xs text-tenue">
                          {c.admin_nombre ?? "—"} · {c.miembros} {c.miembros === 1 ? "persona" : "personas"}
                        </small>
                      </span>
                    </td>
                    <td className="der">{c.movimientos_30d}</td>
                    <td className="text-cuerpo">{c.ultimo_movimiento ? formatearFecha(c.ultimo_movimiento) : "Sin movimientos"}</td>
                    {firma && (
                      <td>
                        {semaforos.has(c.id) ? <Chip tono={semaforos.get(c.id)!.tono}>{semaforos.get(c.id)!.texto}</Chip> : <Chip plano>Fuera del plan</Chip>}
                      </td>
                    )}
                    <td className="pr-4! md:pr-6!">
                      <FormularioAccion accion={cambiarHogar} className="inline-flex">
                        <input type="hidden" name="hogar" value={c.id} />
                        <BotonEnviar variante="fantasma" className="h-8 px-2 text-sm" pendiente="Abriendo…">
                          Abrir
                        </BotonEnviar>
                      </FormularioAccion>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <div className="flex min-w-0 flex-col gap-5">
        {firma ? (
          <>
            <Tarjeta titulo="Tu enlace de referidos" subtitulo={`Gana el ${firma.limites.comision_pct ?? 20} % de lo que paguen los hogares que traigas.`}>
              {firma.ref_codigo ? (
                <div className="flex flex-col gap-2">
                  <input
                    readOnly
                    value={`${sitio()}/registro?ref=${firma.ref_codigo}`}
                    aria-label="Enlace de referidos"
                    className="h-10 w-full rounded-lg border border-control bg-pagina px-3 text-sm text-cuerpo"
                  />
                  <p className="text-[13px] text-tenue">
                    Compártelo por WhatsApp con tus clientes: al registrarse quedan ligados a {firma.nombre}. {firma.referidos} referidos ·{" "}
                    {firma.referidos_pagando} pagando.
                  </p>
                </div>
              ) : (
                <FormularioAccion accion={crearEnlaceReferido} className="flex flex-col gap-2">
                  <input type="hidden" name="firma" value={firma.id} />
                  <BotonEnviar variante="secundario" pendiente="Creando…">
                    Crear mi enlace
                  </BotonEnviar>
                </FormularioAccion>
              )}
            </Tarjeta>
            <Tarjeta titulo="Comisiones" subtitulo="Se liquidan al cerrar cada mes y se pagan el 5 del siguiente.">
              {firma.comisiones.length === 0 ? (
                <p className="text-sm text-tenue">Aún no hay comisiones liquidadas.</p>
              ) : (
                <ul className="flex flex-col">
                  {firma.comisiones.map((c) => (
                    <li key={c.mes} className="flex items-center justify-between gap-3 border-b border-divisor py-2.5 text-sm last:border-0">
                      <span className="text-cuerpo">
                        {c.mes} · {c.hogares} {c.hogares === 1 ? "hogar" : "hogares"}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <b>{formatearCOP(c.monto)}</b>
                        <Chip tono={c.estado === "pagada" ? "ok" : "alerta"}>{c.estado === "pagada" ? "Pagada" : "Pendiente"}</Chip>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>
            {!firma.verificada && (
              <Tarjeta titulo="Verificación">
                <p className="text-sm text-cuerpo">
                  Tu firma aún no está verificada: escríbenos con tu tarjeta profesional y te marcamos como contador verificado.
                </p>
              </Tarjeta>
            )}
          </>
        ) : (
          <MejoraPlan titulo="Panel completo con el plan Contador" compacto>
            Semáforo DIAN de cada cliente, enlace de referidos con comisión y hasta 30 hogares. Actívalo en el hogar de tu firma (Configuración → Plan).
          </MejoraPlan>
        )}
      </div>
    </div>
  );
}

export default function Clientes() {
  return (
    <>
      <Titulo registrar={false} subtitulo="Los hogares que atiendes como contador, con su renta al día">
        Clientes
      </Titulo>
      <Contenido />
    </>
  );
}
