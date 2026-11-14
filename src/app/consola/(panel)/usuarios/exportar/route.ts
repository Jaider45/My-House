import { NextResponse, type NextRequest } from "next/server";
import { obtenerStaff } from "@/lib/consola/sesion";
import { celdaCsv } from "@/lib/consola/auditoria";

const MAX = 20_000;
type Fila = { user_id: string; nombre: string; email: string; hogar: string | null; rol: string | null; dos_pasos: boolean; ultimo_ingreso: string | null; created_at: string; es_equipo: boolean };

/** CSV de usuarios con el filtro y la búsqueda de la lista (permiso Exportar datos). Los correos van enmascarados. */
export async function GET(request: NextRequest) {
  const staff = await obtenerStaff();
  if (!staff.puede("exportar")) return new NextResponse("Tu rol no puede exportar datos.", { status: 403 });
  const p = request.nextUrl.searchParams;
  const filtro = p.get("filtro") ?? "todos";
  const q = p.get("q")?.slice(0, 80) || undefined;
  const filas: Fila[] = [];
  let antes: string | undefined;
  while (filas.length < MAX) {
    const { data, error } = await staff.supabase.rpc("consola_usuarios", { p_buscar: q, p_filtro: filtro, p_antes: antes, p_limite: 100 });
    if (error) return new NextResponse(error.message, { status: 400 });
    const pagina = (data ?? []) as Fila[];
    filas.push(...pagina);
    if (pagina.length < 100) break;
    antes = pagina[pagina.length - 1].created_at;
  }
  const enc = ["id", "nombre", "correo", "hogar", "rol", "dos_pasos", "equipo", "ultimo_ingreso", "alta"];
  const lineas = filas.map((u) => [u.user_id, u.nombre, u.email, u.hogar, u.rol, u.dos_pasos, u.es_equipo, u.ultimo_ingreso, u.created_at].map(celdaCsv).join(","));
  return new NextResponse("\ufeff" + [enc.join(","), ...lineas].join("\r\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="usuarios-${filtro}.csv"`, "cache-control": "no-store" },
  });
}
