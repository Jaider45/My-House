import { NextResponse, type NextRequest } from "next/server";
import { mensajeError } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { celdaCsv, describirAccion } from "@/lib/consola/auditoria";
import { parsearFecha, sumarDias } from "@/lib/fechas";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Descarga del registro de auditoría en CSV (UTF-8 con BOM para que Excel muestre bien las tildes). */
export async function GET(request: NextRequest) {
  const staff = await obtenerStaff();
  if (!staff.puede("auditoria")) return new NextResponse("Tu rol no puede exportar la auditoría.", { status: 403 });

  const p = request.nextUrl.searchParams;
  const desde = p.get("desde") ?? "";
  const hasta = p.get("hasta") ?? "";
  if (!FECHA.test(desde) || !FECHA.test(hasta) || !parsearFecha(desde) || !parsearFecha(hasta)) {
    return new NextResponse("Fechas no válidas.", { status: 400 });
  }
  // Días completos en hora de Bogotá (UTC−5, sin horario de verano).
  const { data, error } = await staff.supabase.rpc("consola_exportar_auditoria", {
    p_desde: `${desde}T00:00:00-05:00`,
    p_hasta: `${sumarDias(hasta, 1)}T00:00:00-05:00`,
  });
  if (error) return new NextResponse(mensajeError(error), { status: 400 });

  const encabezado = ["id", "fecha", "quien", "accion", "descripcion", "objeto_tipo", "objeto_id", "objeto", "detalle", "ip", "navegador"];
  const lineas = (data ?? []).map((f) =>
    [f.id, f.creada, f.quien_nombre, f.accion, describirAccion(f), f.objeto_tipo, f.objeto_id, f.objeto_nombre, f.detalle, f.ip, f.agente].map(celdaCsv).join(","),
  );
  const csv = "﻿" + [encabezado.join(","), ...lineas].join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="auditoria-${desde}-a-${hasta}.csv"`,
      "cache-control": "no-store",
    },
  });
}
