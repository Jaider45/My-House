import Link from "next/link";

const enlace = "font-semibold text-monte underline underline-offset-2";

/**
 * Casillas de la autorización (Ley 1581): aceptar términos y política (obligatoria) y recibir novedades (opcional,
 * desmarcada). Los enlaces abren en otra pestaña para no perder lo escrito en el formulario.
 */
export function CasillasLegales() {
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Autorizaciones</legend>
      <label className="flex items-start gap-3 text-sm leading-5">
        <input type="checkbox" name="acepto" value="1" required className="mt-0.5 size-[18px] shrink-0 accent-monte" />
        <span>
          Acepto los{" "}
          <Link href="/terminos" target="_blank" className={enlace}>
            términos y condiciones
          </Link>{" "}
          y autorizo el tratamiento de mis datos según la{" "}
          <Link href="/privacidad" target="_blank" className={enlace}>
            política de tratamiento de datos
          </Link>
          .
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm leading-5 text-cuerpo">
        <input type="checkbox" name="comunicaciones" value="1" className="mt-0.5 size-[18px] shrink-0 accent-monte" />
        <span>Quiero recibir novedades y promociones de My House por correo (opcional; lo cambias cuando quieras).</span>
      </label>
    </fieldset>
  );
}
