import { NextResponse, type NextRequest } from "next/server";
import { obtenerStaff } from "@/lib/consola/sesion";
import { celdaCsv } from "@/lib/consola/auditoria";

const MAX = 20_000;
type Fila = { id: string; creado: string; hogar: string; plan: string; periodo: string; motivo: string; monto: number; cupon: string | null; estado: string; metodo: string | null; factura_estado: string };

/** CSV de cobros con el filtro de la lista (permiso Exportar datos). */
export async function GET(request: NextRequest) {
  const staff = await obtenerStaff();
  if (!staff.puede("exportar")) return new NextResponse("Tu rol no puede exportar datos.", { status: 403 });
  const estado = request.nextUrl.searchParams.get("estado") || undefined;
  const filas: Fila[] = [];
  let antes: string | undefined;
  while (filas.length < MAX) {
    const { data, error } = await staff.supabase.rpc("consola_cobros", { p_estado: estado, p_antes: antes, p_limite: 100 });
    if (error) return new NextResponse(error.message, { status: 400 });
    const pagina = (data ?? []) as Fila[];
    filas.push(...pagina);
    if (pagina.length < 100) break;
    antes = pagina[pagina.length - 1].creado;
  }
  const enc = ["id", "fecha", "hogar", "plan", "periodo", "motivo", "monto", "cupon", "estado", "metodo", "factura"];
  const lineas = filas.map((c) => [c.id, c.creado, c.hogar, c.plan, c.periodo, c.motivo, c.monto, c.cupon, c.estado, c.metodo, c.factura_estado].map(celdaCsv).join(","));
  return new NextResponse("﻿" + [enc.join(","), ...lineas].join("\r\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="cobros${estado ? `-${estado}` : ""}.csv"`, "cache-control": "no-store" },
  });
}
