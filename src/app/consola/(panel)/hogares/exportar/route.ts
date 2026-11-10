import { NextResponse, type NextRequest } from "next/server";
import { obtenerStaff } from "@/lib/consola/sesion";
import { celdaCsv } from "@/lib/consola/auditoria";
import type { FilaHogar } from "../comun";

const MAX = 20_000;

/** CSV de hogares con el filtro y la búsqueda de la lista (permiso Exportar datos). */
export async function GET(request: NextRequest) {
  const staff = await obtenerStaff();
  if (!staff.puede("exportar")) return new NextResponse("Tu rol no puede exportar datos.", { status: 403 });
  const p = request.nextUrl.searchParams;
  const filtro = p.get("filtro") ?? "todos";
  const q = p.get("q")?.slice(0, 80) || undefined;

  const filas: FilaHogar[] = [];
  let antes: string | undefined;
  while (filas.length < MAX) {
    const { data, error } = await staff.supabase.rpc("consola_hogares", { p_buscar: q, p_filtro: filtro, p_antes: antes, p_limite: 100 });
    if (error) return new NextResponse(error.message, { status: 400 });
    const pagina = (data ?? []) as FilaHogar[];
    filas.push(...pagina);
    if (pagina.length < 100) break;
    antes = pagina[pagina.length - 1].created_at;
  }

  const enc = ["id", "hogar", "administrador", "plan", "plan_efectivo", "personas", "movimientos_30d", "mrr", "estado", "en_prueba", "ultimo_uso", "alta"];
  const lineas = filas.map((h) =>
    [h.id, h.nombre, h.admin_nombre, h.plan, h.plan_efectivo, h.miembros, h.movimientos_30d, h.mrr, h.estado, h.en_prueba, h.ultimo_uso, h.created_at].map(celdaCsv).join(","),
  );
  return new NextResponse("﻿" + [enc.join(","), ...lineas].join("\r\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="hogares-${filtro}.csv"`,
      "cache-control": "no-store",
    },
  });
}
