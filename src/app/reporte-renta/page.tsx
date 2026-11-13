import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { obtenerContexto } from "@/lib/sesion";
import { cargarReporte } from "@/lib/impuestos/reporte-servidor";
import { estadoSoportes } from "@/lib/impuestos/reporte";
import { formatearCOP } from "@/lib/dinero";
import { formatearFecha } from "@/lib/fechas";
import { BotonImprimir } from "./imprimir";

export const metadata: Metadata = { title: "Reporte de renta" };

const ESTADO: Record<string, string> = { verde: "Bajo el tope", amarillo: "Cerca", rojo: "Obligado" };

/**
 * Reporte de renta para el contador, en una página pensada para imprimir o guardar como PDF (sin el menú de la
 * app). Mismos datos que la descarga para Excel. La lectura de sesión va detrás de Suspense (Cache Components).
 */
export default function ReporteRenta({ searchParams }: PageProps<"/reporte-renta">) {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-tenue">Armando el reporte…</p>}>
      <Reporte searchParams={searchParams} />
    </Suspense>
  );
}

async function Reporte({ searchParams }: { searchParams: PageProps<"/reporte-renta">["searchParams"] }) {
  const ctx = await obtenerContexto();
  const sp = await searchParams;
  const pedido = typeof sp.anio === "string" ? sp.anio : "";
  const anio = /^\d{4}$/.test(pedido) ? Number(pedido) : Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric" }).format(new Date()));
  const d = await cargarReporte(ctx, anio);
  const personas = [...new Set(d.topes.map((t) => t.persona))];
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 bg-white p-6 text-tinta md:p-10 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-borde pb-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold text-monte">My House</p>
          <h1 className="text-2xl font-bold">Reporte de renta · año gravable {anio}</h1>
          <p className="text-sm text-cuerpo">
            {d.hogar} · generado el {formatearFecha(d.generado)}
            {d.valorUnidad ? ` · ${d.unidad} ${anio}: ${formatearCOP(d.valorUnidad)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <BotonImprimir />
          <a href={`/api/reporte-renta?anio=${anio}`} className="inline-flex h-11 items-center rounded-[10px] border border-cuerpo px-4 text-[15px] font-semibold">
            Descargar Excel
          </a>
          <Link href={`/impuestos?anio=${anio}`} className="inline-flex h-11 items-center px-2 text-[15px] font-semibold underline">
            Volver
          </Link>
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Topes para declarar</h2>
        {personas.map((p) => (
          <table key={p} className="w-full border-collapse text-sm">
            <caption className="py-1 text-left font-semibold">{p}</caption>
            <thead>
              <tr className="border-b border-borde text-left text-tenue">
                <th className="py-1.5 font-semibold">Tope</th>
                <th className="py-1.5 text-right font-semibold">Acumulado</th>
                <th className="py-1.5 text-right font-semibold">Tope</th>
                <th className="py-1.5 text-right font-semibold">%</th>
                <th className="py-1.5 pl-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {d.topes
                .filter((t) => t.persona === p)
                .map((t) => (
                  <tr key={t.tope} className="border-b border-divisor">
                    <td className="py-1.5">{t.tope}</td>
                    <td className="py-1.5 text-right">{formatearCOP(t.acumulado)}</td>
                    <td className="py-1.5 text-right">{formatearCOP(t.topePesos)}</td>
                    <td className="py-1.5 text-right">{t.porcentaje} %</td>
                    <td className="py-1.5 pl-3 font-semibold">{ESTADO[t.estado] ?? t.estado}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        ))}
        {!personas.length && <p className="text-sm text-tenue">Sin parámetros DIAN publicados para {anio}.</p>}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Totales por etiqueta tributaria</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-borde text-left text-tenue">
              <th className="py-1.5 font-semibold">Etiqueta</th>
              <th className="py-1.5 text-right font-semibold">Movimientos</th>
              <th className="py-1.5 text-right font-semibold">Total</th>
              <th className="py-1.5 pl-3 font-semibold">Soportes</th>
            </tr>
          </thead>
          <tbody>
            {d.etiquetas.map((e) => (
              <tr key={e.etiqueta} className="border-b border-divisor">
                <td className="py-1.5 font-semibold">{e.etiqueta}</td>
                <td className="py-1.5 text-right">{e.movimientos}</td>
                <td className="py-1.5 text-right">{formatearCOP(e.total)}</td>
                <td className="py-1.5 pl-3">{estadoSoportes(e).texto}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!d.etiquetas.length && <p className="text-sm text-tenue">Aún no hay movimientos con etiqueta DIAN en {anio}.</p>}
      </section>

      {d.movimientos.length > 0 && (
        <section className="flex flex-col gap-2 print:break-before-page">
          <h2 className="text-lg font-bold">Movimientos con etiqueta</h2>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-borde text-left text-tenue">
                <th className="py-1 font-semibold">Fecha</th>
                <th className="py-1 font-semibold">Persona</th>
                <th className="py-1 font-semibold">Concepto</th>
                <th className="py-1 font-semibold">Etiqueta</th>
                <th className="py-1 text-right font-semibold">Monto</th>
                <th className="py-1 pl-2 font-semibold">Soporte</th>
              </tr>
            </thead>
            <tbody>
              {d.movimientos.map((m, i) => (
                <tr key={i} className="border-b border-divisor">
                  <td className="py-1">{m.fecha}</td>
                  <td className="py-1">{m.persona ?? "—"}</td>
                  <td className="py-1">{m.concepto}</td>
                  <td className="py-1">{m.etiqueta}</td>
                  <td className="py-1 text-right">{formatearCOP(m.monto)}</td>
                  <td className="py-1 pl-2">{m.soporte ? "Sí" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <p className="text-xs text-tenue">Cálculo orientativo con lo registrado en My House. La decisión final de declarar y lo que se declara es del contador y del contribuyente.</p>
    </main>
  );
}
