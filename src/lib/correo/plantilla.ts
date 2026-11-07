/**
 * Plantilla única de los correos de My House (diseño «Email» del lienzo de pantallas). Arma HTML compatible con los
 * clientes de correo (tablas y estilos en línea: Gmail y Outlook ignoran flex y grid) y una versión en texto plano.
 * Sin dependencias: la usan la app (correos propios) y el generador de plantillas de Supabase.
 */

/** Texto que va tal cual, sin escapar: variables de las plantillas de Supabase (`{{ .Token }}`). */
export type Crudo = { crudo: string };
export type Texto = string | Crudo | Texto[];
export const crudo = (t: string): Crudo => ({ crudo: t });

export type TonoIcono = "claro" | "monte" | "error" | "alerta";
export type Fila = { k: Texto; v: Texto; grande?: boolean; tono?: "error" };
export type Boton = { texto: string; url: Texto };

export type Contenido = {
  asunto: Texto;
  /** Lo que el buzón muestra después del asunto. */
  vistaPrevia: Texto;
  etiqueta: string;
  icono?: { nombre: string; tono: TonoIcono };
  titulo: Texto;
  intro: Texto;
  codigo?: { valor: Texto; nota: Texto };
  tarjeta?: { filas: Fila[]; tono?: "neutro" | "ok" | "error" };
  lista?: { titulo?: string; items: { n: string; t: Texto; d: Texto }[] };
  cifras?: { k: string; v: string; d: string }[];
  nota?: { texto: Texto; tono?: "neutro" | "alerta" | "error" };
  botones?: [Boton] | [Boton, Boton];
  /** Si el botón no abre: el mismo enlace para copiar y pegar. */
  enlaceAlterno?: Texto;
  meta?: Texto;
  despedida?: string;
  porque: Texto;
  enlacesPie?: { texto: string; url: Texto }[];
};

const C = {
  pagina: "#f2efea", elevada: "#ffffff", arena: "#faf5ee", monte: "#143d33", cuerpo: "#4a5652", borde: "#e6e2db",
  bordeCabeza: "#efe7db", divisor: "#f0ece6", seleccion: "#eef3f0", mosaico: "#f6efe6",
  okBorde: "#d6e3dd", errorTinta: "#93290f", errorFondo: "#fbe3dc", errorTarjeta: "#fff7f4", errorBorde: "#f2c4b5",
  alertaFondo: "#fbf0d5", alertaTinta: "#6f4c00",
};
const FUENTE = "Figtree, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const escapar = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** HTML de un texto: escapa lo normal, deja lo crudo y convierte saltos de línea en <br>. */
export function html(t: Texto): string {
  if (Array.isArray(t)) return t.map(html).join("");
  if (typeof t === "string") return escapar(t).replaceAll("\n", "<br>");
  return t.crudo;
}
/** Texto plano (para la parte text/plain y para el asunto). */
export function plano(t: Texto): string {
  if (Array.isArray(t)) return t.map(plano).join("");
  return typeof t === "string" ? t : t.crudo;
}

const p = (estilo: string, contenido: string) => `<p style="margin:0;${estilo}">${contenido}</p>`;
const bloque = (contenido: string, abajo = 20) => `<tr><td style="padding:0 0 ${abajo}px 0">${contenido}</td></tr>`;
const tabla = (contenido: string, estilo = "") =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;${estilo}">${contenido}</table>`;

function htmlBotones(botones: NonNullable<Contenido["botones"]>) {
  const celdas = botones.map((b, i) => {
    const primario = i === 0;
    const estilo = primario
      ? `background:${C.monte};color:${C.arena};border:1px solid ${C.monte}`
      : `background:${C.elevada};color:${C.monte};border:1px solid ${C.cuerpo}`;
    return `<td class="mh-boton" style="padding:0 12px 12px 0"><a href="${html(b.url)}" style="display:inline-block;${estilo};font-family:${FUENTE};font-size:16px;line-height:20px;font-weight:700;text-decoration:none;padding:14px 26px;border-radius:10px;text-align:center">${escapar(b.texto)}</a></td>`;
  });
  return `<table class="mh-botones" role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${celdas.join("")}</tr></table>`;
}

/** Arma el correo completo. `sitio`: URL base para las imágenes (en Supabase, `{{ .SiteURL }}`). */
export function armarCorreo(c: Contenido, sitio: Texto): { asunto: string; html: string; texto: string } {
  const base = html(sitio);
  const img = (archivo: string) => `${base}/correo/${archivo}`;
  const filas: string[] = [];

  if (c.icono) {
    filas.push(bloque(`<img src="${img(`${c.icono.nombre}-${c.icono.tono}.png`)}" width="56" height="56" alt="" style="display:block;border:0;border-radius:16px">`));
  }
  filas.push(bloque(`<h1 class="mh-titulo" style="margin:0;font-family:${FUENTE};font-size:28px;line-height:1.2;font-weight:700;color:${C.monte}">${html(c.titulo)}</h1>`));
  filas.push(bloque(p(`font-size:16px;line-height:26px;color:${C.cuerpo}`, html(c.intro))));

  if (c.codigo) {
    filas.push(
      bloque(
        tabla(
          `<tr><td style="background:${C.seleccion};border-radius:14px;padding:22px;text-align:center">
            ${p(`font-size:13px;font-weight:600;color:${C.cuerpo};padding-bottom:6px`, "Tu código")}
            ${p(`font-size:42px;line-height:1;font-weight:700;letter-spacing:0.18em;color:${C.monte};font-variant-numeric:tabular-nums`, `<span class="mh-codigo">${html(c.codigo.valor)}</span>`)}
            ${p(`font-size:13px;color:${C.cuerpo};padding-top:10px`, html(c.codigo.nota))}
          </td></tr>`,
        ),
      ),
    );
  }

  if (c.tarjeta) {
    const tono = c.tarjeta.tono ?? "neutro";
    const fondo = tono === "ok" ? C.seleccion : tono === "error" ? C.errorTarjeta : C.elevada;
    const borde = tono === "ok" ? C.okBorde : tono === "error" ? C.errorBorde : C.borde;
    const lineas = c.tarjeta.filas
      .map(
        (f, i) =>
          `<tr><td style="padding:${i ? 12 : 0}px 16px 0 0;font-size:15px;line-height:22px;color:${C.cuerpo};vertical-align:baseline">${html(f.k)}</td>` +
          `<td style="padding:${i ? 12 : 0}px 0 0 0;font-size:${f.grande ? 22 : 15}px;line-height:${f.grande ? 28 : 22}px;font-weight:700;color:${f.tono === "error" ? C.errorTinta : C.monte};text-align:right;vertical-align:baseline;font-variant-numeric:tabular-nums">${html(f.v)}</td></tr>`,
      )
      .join("");
    filas.push(bloque(tabla(`<tr><td style="background:${fondo};border:1px solid ${borde};border-radius:14px;padding:18px 20px">${tabla(lineas)}</td></tr>`)));
  }

  if (c.cifras?.length) {
    const pares: string[] = [];
    for (let i = 0; i < c.cifras.length; i += 2) {
      const celda = (s?: { k: string; v: string; d: string }, izquierda = true) =>
        s
          ? `<td class="mh-cifra" width="50%" style="padding:0 ${izquierda ? 5 : 0}px 10px ${izquierda ? 0 : 5}px;vertical-align:top"><div style="background:${C.mosaico};border-radius:12px;padding:14px 16px">
              ${p(`font-size:13px;line-height:18px;color:${C.cuerpo}`, escapar(s.k))}
              ${p(`font-size:20px;line-height:28px;font-weight:700;color:${C.monte};font-variant-numeric:tabular-nums`, escapar(s.v))}
              ${p(`font-size:12px;line-height:17px;color:${C.cuerpo}`, escapar(s.d))}</div></td>`
          : `<td class="mh-cifra" width="50%"></td>`;
      pares.push(`<tr>${celda(c.cifras[i])}${celda(c.cifras[i + 1], false)}</tr>`);
    }
    filas.push(bloque(tabla(pares.join("")), 10));
  }

  if (c.lista) {
    const items = c.lista.items
      .map(
        (l, i) =>
          `<tr><td width="32" style="padding:${i ? 14 : 0}px 14px 0 0;vertical-align:top"><div style="width:32px;height:32px;line-height:32px;border-radius:16px;background:${C.monte};color:${C.arena};font-size:14px;font-weight:700;text-align:center">${escapar(l.n)}</div></td>` +
          `<td style="padding:${i ? 14 : 0}px 0 0 0;font-size:15px;line-height:22px;color:${C.cuerpo};vertical-align:top"><b style="color:${C.monte}">${html(l.t)}</b><br>${html(l.d)}</td></tr>`,
      )
      .join("");
    const titulo = c.lista.titulo ? p(`font-size:15px;line-height:22px;font-weight:700;color:${C.monte};padding-bottom:14px`, escapar(c.lista.titulo)) : "";
    filas.push(bloque(titulo + tabla(items)));
  }

  if (c.nota) {
    const tono = c.nota.tono ?? "neutro";
    const [fondo, tinta] = tono === "error" ? [C.errorFondo, C.errorTinta] : tono === "alerta" ? [C.alertaFondo, C.alertaTinta] : [C.mosaico, C.cuerpo];
    filas.push(bloque(tabla(`<tr><td style="background:${fondo};color:${tinta};border-radius:12px;padding:14px 16px;font-size:14px;line-height:21px">${html(c.nota.texto)}</td></tr>`)));
  }

  if (c.botones) filas.push(bloque(htmlBotones(c.botones), 8));

  if (c.enlaceAlterno) {
    filas.push(
      bloque(
        p(
          `font-size:13px;line-height:20px;color:${C.cuerpo}`,
          `¿No funciona el botón? Copia y pega este enlace en tu navegador:<br><a href="${html(c.enlaceAlterno)}" style="color:${C.monte};word-break:break-all">${html(c.enlaceAlterno)}</a>`,
        ),
      ),
    );
  }

  if (c.meta) filas.push(bloque(p(`font-size:13px;line-height:20px;color:${C.cuerpo};border-top:1px solid ${C.divisor};padding-top:16px`, html(c.meta))));
  filas.push(bloque(p(`font-size:15px;line-height:24px;color:${C.cuerpo}`, escapar(c.despedida ?? "El equipo de My House")), 0));

  const pie = [
    html(c.porque),
    c.enlacesPie?.length ? c.enlacesPie.map((e) => `<a href="${html(e.url)}" style="color:${C.cuerpo};text-decoration:underline">${escapar(e.texto)}</a>`).join(" · ") : "",
    "My House · Finanzas del hogar · Bogotá, Colombia",
    "Nunca te pediremos tu contraseña, códigos ni claves de tu banco por correo.",
  ]
    .filter(Boolean)
    .map((t) => p(`font-size:12px;line-height:19px;color:${C.cuerpo};padding-top:6px`, t))
    .join("");

  // Relleno invisible tras la vista previa: evita que el buzón muestre el resto del cuerpo junto al asunto.
  const relleno = "&#847;&zwnj;&nbsp;".repeat(60);

  const documento = `<!doctype html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapar(plano(c.asunto))}</title>
<style>
@import url("https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700&display=swap");
body{margin:0;padding:0;-webkit-text-size-adjust:100%}
a{color:${C.monte}}
@media (max-width:620px){
  .mh-exterior{padding:16px 8px 24px !important}
  .mh-cabeza{padding:18px 20px !important}
  .mh-cuerpo{padding:24px 20px 28px !important}
  .mh-titulo{font-size:24px !important}
  .mh-codigo{font-size:34px !important}
  .mh-botones{width:100% !important}
  .mh-boton{display:block !important;width:100% !important;padding-right:0 !important}
  .mh-boton a{display:block !important}
  .mh-cifra{display:block !important;width:100% !important;padding:0 0 10px 0 !important}
}
</style>
</head>
<body style="margin:0;padding:0;background:${C.pagina}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${html(c.vistaPrevia)}${relleno}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.pagina}">
<tr><td class="mh-exterior" align="center" style="padding:40px 40px 48px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;font-family:${FUENTE};color:${C.monte}">
<tr><td style="background:${C.elevada};border:1px solid ${C.borde};border-radius:16px;overflow:hidden">
  ${tabla(`<tr>
    <td class="mh-cabeza" style="background:${C.arena};padding:22px 32px;border-bottom:1px solid ${C.bordeCabeza};border-radius:16px 16px 0 0">
      ${tabla(`<tr><td><img src="${img("logo.png")}" width="102" height="30" alt="My House" style="display:block;border:0;font-size:18px;font-weight:700;color:${C.monte}"></td>
      <td align="right" style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${C.cuerpo}">${escapar(c.etiqueta)}</td></tr>`)}
    </td></tr>
    <tr><td class="mh-cuerpo" style="padding:36px 40px 40px">${tabla(filas.join("\n"))}</td></tr>`)}
</td></tr>
<tr><td align="center" style="padding:8px 12px 0;text-align:center">${pie}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;

  return { asunto: plano(c.asunto), html: documento, texto: textoPlano(c) };
}

/** Versión text/plain: mejora la entrega (filtros de spam) y se lee en relojes y clientes sin HTML. */
function textoPlano(c: Contenido): string {
  const l: string[] = [plano(c.titulo).toUpperCase(), "", plano(c.intro)];
  if (c.codigo) l.push("", `Tu código: ${plano(c.codigo.valor)}`, plano(c.codigo.nota));
  if (c.tarjeta) l.push("", ...c.tarjeta.filas.map((f) => `${plano(f.k)}: ${plano(f.v)}`));
  if (c.cifras?.length) l.push("", ...c.cifras.map((s) => `${s.k}: ${s.v} (${s.d})`));
  if (c.lista) l.push("", ...(c.lista.titulo ? [c.lista.titulo] : []), ...c.lista.items.map((i) => `${i.n}. ${plano(i.t)} — ${plano(i.d)}`));
  if (c.nota) l.push("", plano(c.nota.texto));
  if (c.botones) l.push("", ...c.botones.map((b) => `${b.texto}: ${plano(b.url)}`));
  if (c.meta) l.push("", plano(c.meta));
  l.push("", c.despedida ?? "El equipo de My House", "", "—", plano(c.porque), "Nunca te pediremos tu contraseña, códigos ni claves de tu banco por correo.");
  return l.join("\n");
}
