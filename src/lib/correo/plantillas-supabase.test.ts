import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MINUTOS_OTP, PLANTILLAS_SUPABASE, plantillaSupabase } from "./supabase";

/**
 * Las plantillas de supabase/templates/ salen de src/lib/correo. Si esta prueba falla, alguien editó una a mano o
 * cambió el diseño: regenéralas con `ACTUALIZAR_CORREOS=1 npx vitest run src/lib/correo` (y pégalas en la nube).
 */
const DIR = join(process.cwd(), "supabase", "templates");
const config = readFileSync(join(process.cwd(), "supabase", "config.toml"), "utf8").replace(/\r\n/g, "\n");

describe("plantillas de Supabase", () => {
  for (const archivo of Object.keys(PLANTILLAS_SUPABASE) as (keyof typeof PLANTILLAS_SUPABASE)[]) {
    it(`${archivo} está al día y conectada en config.toml`, () => {
      const { html, asunto } = plantillaSupabase(archivo);
      if (process.env.ACTUALIZAR_CORREOS) writeFileSync(join(DIR, archivo), html);
      expect(readFileSync(join(DIR, archivo), "utf8")).toBe(html);
      const bloque = config.split(`[${PLANTILLAS_SUPABASE[archivo].seccion}]`)[1]?.split("\n[")[0] ?? "";
      expect(bloque).toContain(`content_path = "./supabase/templates/${archivo}"`);
      expect(bloque).toContain(`subject = "${asunto}"`);
    });
  }

  it("la vigencia del texto coincide con otp_expiry", () => {
    expect(config).toMatch(new RegExp(`\\[auth\\.email\\][\\s\\S]*?otp_expiry = ${MINUTOS_OTP * 60}\\b`));
  });

  it("no queda texto suelto sin escapar ni variables mal cerradas", () => {
    for (const archivo of Object.keys(PLANTILLAS_SUPABASE) as (keyof typeof PLANTILLAS_SUPABASE)[]) {
      const { html } = plantillaSupabase(archivo);
      expect((html.match(/{{/g) ?? []).length).toBe((html.match(/}}/g) ?? []).length);
      expect(html).toContain("{{ .SiteURL }}/correo/logo.png");
    }
  });
});
