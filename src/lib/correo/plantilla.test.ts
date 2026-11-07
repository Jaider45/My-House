import { describe, expect, it } from "vitest";
import { correoInvitacion } from "./correos";
import { muestras } from "./muestras";
import { armarCorreo, crudo, html, plano } from "./plantilla";

const SITIO = "https://myhouse.app";

describe("plantilla de correo", () => {
  for (const [clave, m] of Object.entries(muestras(SITIO))) {
    it(`${clave}: arma HTML y texto sin huecos`, () => {
      const c = armarCorreo(m.contenido, SITIO);
      for (const salida of [c.asunto, c.html, c.texto]) expect(salida).not.toMatch(/undefined|NaN|\[object|null/);
      expect(c.html).toContain(`${SITIO}/correo/logo.png`);
      expect(c.html).toContain(plano(m.contenido.vistaPrevia).split(" ")[0]);
      expect(c.html).toContain("Nunca te pediremos tu contraseña");
      for (const b of m.contenido.botones ?? []) {
        expect(c.html).toContain(`href="${html(b.url)}"`);
        expect(c.texto).toContain(plano(b.url));
      }
      if (m.contenido.icono) expect(c.html).toContain(`/correo/${m.contenido.icono.nombre}-${m.contenido.icono.tono}.png`);
    });
  }

  it("escapa lo que escriben las personas y deja intactas las variables de Supabase", () => {
    const c = armarCorreo(correoInvitacion({ quien: '<script>x</script> & "Beto"', hogar: "Casa <b>", rol: "editor", url: `${SITIO}/i/1`, vence: "hoy" }), SITIO);
    expect(c.html).not.toContain("<script>");
    expect(c.html).toContain("&lt;script&gt;x&lt;/script&gt; &amp; &quot;Beto&quot;");
    expect(c.asunto).toBe('<script>x</script> & "Beto" te invitó a Casa <b>');
    expect(html(["Hola ", crudo("{{ .Data.nombre }}"), ","])).toBe("Hola {{ .Data.nombre }},");
  });

  it("los saltos de línea del texto se vuelven <br>", () => {
    expect(html("uno\ndos")).toBe("uno<br>dos");
  });
});
