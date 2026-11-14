"use client";

import { useActionState } from "react";
import { AreaTexto, Campo } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import { CAMPOS, type TextosCorreo } from "@/lib/correo/textos";
import { guardarTextosCorreo } from "../../editor-acciones";

/** Formulario de textos de un correo automático: cada campo muestra el texto original como sugerencia. */
export function TextosCorreoForm({ clave, actuales, originales, variables, puede }: { clave: string; actuales: TextosCorreo; originales: Record<string, string>; variables: string[]; puede: boolean }) {
  const [estado, enviar] = useActionState(guardarTextosCorreo, null);
  return (
    <form action={enviar} className="flex flex-col gap-3" key={JSON.stringify(actuales)}>
      <input type="hidden" name="clave" value={clave} />
      <fieldset disabled={!puede} className="flex flex-col gap-3">
        {CAMPOS.filter((c) => c.clave !== "nota" || originales.nota || actuales.nota).map((c) =>
          c.largo ? (
            <AreaTexto key={c.clave} etiqueta={c.texto} name={c.clave} defaultValue={actuales[c.clave] ?? ""} placeholder={originales[c.clave] ?? ""} maxLength={600} rows={3} />
          ) : (
            <Campo key={c.clave} etiqueta={c.texto} name={c.clave} defaultValue={actuales[c.clave] ?? ""} placeholder={originales[c.clave] ?? ""} maxLength={600} />
          ),
        )}
      </fieldset>
      <p className="text-[13px] text-tenue">
        Vacío = el texto original. Variables: {variables.map((v) => `{${v}}`).join(" ")}. Las cifras de la tarjeta y los enlaces salen siempre de los datos reales.
      </p>
      <MensajeEstado estado={estado} />
      {puede && (
        <div className="flex flex-wrap gap-2">
          <BotonEnviar pendiente="Guardando…">Guardar textos</BotonEnviar>
          <BotonEnviar variante="fantasma" name="restablecer" value="1" pendiente="…">
            Restablecer originales
          </BotonEnviar>
        </div>
      )}
    </form>
  );
}
