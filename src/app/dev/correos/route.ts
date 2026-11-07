import { connection, type NextRequest } from "next/server";
import { muestras } from "@/lib/correo/muestras";
import { armarCorreo } from "@/lib/correo/plantilla";

/**
 * Vista previa de los correos (solo en desarrollo): /dev/correos lista todos; /dev/correos?tipo=resumen muestra uno
 * tal como llega; &formato=texto, su versión en texto plano.
 */
export async function GET(request: NextRequest) {
  await connection(); // por request: en el build respondería 404 y quedaría guardada así
  if (process.env.NODE_ENV === "production" && !process.env.VISTA_CORREOS) return new Response("No encontrado", { status: 404 });
  const sitio = request.nextUrl.origin;
  const todas = muestras(sitio);
  const tipo = request.nextUrl.searchParams.get("tipo");
  if (tipo && todas[tipo]) {
    const correo = armarCorreo(todas[tipo].contenido, sitio);
    if (request.nextUrl.searchParams.get("formato") === "texto") return new Response(correo.texto, { headers: { "content-type": "text/plain; charset=utf-8" } });
    return new Response(correo.html, { headers: { "content-type": "text/html; charset=utf-8" } });
  }
  const tarjetas = Object.entries(todas)
    .map(([clave, m]) => {
      const { asunto } = armarCorreo(m.contenido, sitio);
      return `<section><h2>${m.nombre}</h2><p><b>Asunto:</b> ${asunto.replaceAll("<", "&lt;")} · <a href="?tipo=${clave}" target="_blank">abrir</a> · <a href="?tipo=${clave}&formato=texto" target="_blank">texto</a></p>
      <div class="marcos"><iframe src="?tipo=${clave}" title="${m.nombre} en escritorio" width="680" height="900"></iframe><iframe src="?tipo=${clave}" title="${m.nombre} en celular" width="390" height="900"></iframe></div></section>`;
    })
    .join("");
  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Correos · My House</title>
    <style>body{font-family:system-ui,sans-serif;background:#e6e2db;margin:0;padding:24px;color:#143d33}section{margin:0 0 40px}h2{margin:0 0 4px}p{margin:0 0 12px;color:#4a5652}
    .marcos{display:flex;gap:16px;align-items:flex-start;overflow-x:auto}iframe{border:1px solid #c9c3b8;border-radius:12px;background:#fff;flex:none}</style></head>
    <body><h1>Correos de My House</h1><p>Vista previa con datos de ejemplo (solo en desarrollo). Los de acceso los envía Supabase con estas mismas plantillas.</p>${tarjetas}</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
