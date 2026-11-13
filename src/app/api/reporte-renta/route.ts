import { type NextRequest } from "next/server";
import { obtenerContexto } from "@/lib/sesion";
import { cargarReporte } from "@/lib/impuestos/reporte-servidor";
import { csvReporte } from "@/lib/impuestos/reporte";

/** «Exportar para el contador» → Excel: el reporte de renta del año en CSV (lo abre Excel con tildes y columnas). */
export async function GET(request: NextRequest) {
  const ctx = await obtenerContexto();
  const pedido = request.nextUrl.searchParams.get("anio") ?? "";
  const anio = /^\d{4}$/.test(pedido) ? Number(pedido) : Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric" }).format(new Date()));
  const datos = await cargarReporte(ctx, anio);
  return new Response(csvReporte(datos), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="reporte-renta-${anio}.csv"`,
      "cache-control": "no-store",
    },
  });
}
