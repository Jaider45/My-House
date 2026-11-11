import { NextResponse, type NextRequest } from "next/server";
import { mensajeError } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import { celdaCsv } from "@/lib/consola/auditoria";
import { crearClienteServicio, hayServicio } from "@/lib/supabase/servicio";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Los enlaces a los soportes valen 7 días: tiempo para que el titular los descargue. */
const VIGENCIA_ENLACES = 7 * 24 * 3600;

type Exportacion = {
  hogares: { nombre: string; movimientos: Record<string, unknown>[]; soportes: { archivo: string; enlace?: string | null }[] }[];
};

/**
 * Datos del titular de una solicitud (Ley 1581): JSON completo con enlaces temporales a sus soportes, o CSV de
 * movimientos. La función de la base exige el permiso, marca la solicitud y deja la exportación en la auditoría.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/consola/privacidad/solicitudes/[id]/exportar">) {
  const staff = await obtenerStaff();
  if (!staff.puede("auditoria")) return new NextResponse("Tu rol no atiende solicitudes de datos.", { status: 403 });
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse("Solicitud no válida.", { status: 400 });
  const { data, error } = await staff.supabase.rpc("consola_exportar_titular", { p_id: id });
  if (error) return new NextResponse(mensajeError(error), { status: 400 });
  const datos = data as unknown as Exportacion;
  const formato = request.nextUrl.searchParams.get("formato") === "csv" ? "csv" : "json";

  if (formato === "csv") {
    const columnas = ["hogar", "fecha", "tipo", "monto", "comercio", "estado", "origen", "ambito", "created_at"];
    const filas = datos.hogares.flatMap((h) => h.movimientos.map((m) => [h.nombre, ...columnas.slice(1).map((c) => m[c])].map(celdaCsv).join(",")));
    return new NextResponse("﻿" + [columnas.join(","), ...filas].join("\r\n"), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="movimientos-titular.csv"`, "cache-control": "no-store" },
    });
  }

  // Enlaces firmados a los archivos (Storage no se lee con la sesión del equipo: solo con la llave del servidor).
  if (hayServicio()) {
    const db = crearClienteServicio();
    for (const h of datos.hogares) {
      const rutas = h.soportes.map((s) => s.archivo);
      if (!rutas.length) continue;
      const { data: firmados } = await db.storage.from("soportes").createSignedUrls(rutas, VIGENCIA_ENLACES);
      const porRuta = new Map((firmados ?? []).map((f) => [f.path, f.signedUrl]));
      for (const s of h.soportes) s.enlace = porRuta.get(s.archivo) ?? null;
    }
  }
  return new NextResponse(JSON.stringify(datos, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="datos-titular.json"`, "cache-control": "no-store" },
  });
}
