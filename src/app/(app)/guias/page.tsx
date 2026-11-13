import { Chip, CuadroIcono, Tarjeta, Titulo } from "@/components/ui";
import { BotonGuia } from "@/components/guia/boton-guia";
import { obtenerContexto, obtenerUsuario } from "@/lib/sesion";
import { guiasPara, leerVistas } from "@/lib/guias";

export const metadata = { title: "Guías" };

export default async function Guias() {
  const [ctx, { user }] = await Promise.all([obtenerContexto(), obtenerUsuario()]);
  const vistas = new Set(leerVistas(user.user_metadata));
  const guias = guiasPara(ctx.miembro.rol);
  return (
    <>
      <Titulo subtitulo="Te llevo de la mano por cada pantalla: ilumino lo que toca usar y te explico para qué sirve" registrar={false}>
        Guías paso a paso
      </Titulo>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-3">
        {guias.map((g) => (
          <Tarjeta key={g.id} className="flex flex-col">
            <div className="flex items-start gap-3">
              <CuadroIcono nombre={g.icono} tamano={44} />
              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] leading-[22px] font-bold">{g.titulo}</h2>
                <p className="mt-1 text-sm text-cuerpo">{g.descripcion}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-1 items-end justify-between gap-3">
              <span className="flex items-center gap-2 text-[13px] text-tenue">
                {g.pasos.length} pasos
                {vistas.has(g.id) && <Chip tono="ok">Hecha</Chip>}
              </span>
              <BotonGuia id={g.id} variante={vistas.has(g.id) ? "secundario" : "primario"}>
                {vistas.has(g.id) ? "Repetir" : "Empezar"}
              </BotonGuia>
            </div>
          </Tarjeta>
        ))}
      </div>
    </>
  );
}
