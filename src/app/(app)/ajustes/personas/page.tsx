import { AccionPrincipal, Boton, Chip, Tarjeta, Titulo, Vacio } from "@/components/ui";
import { Ventana } from "@/components/ui/ventana";
import { obtenerContexto } from "@/lib/sesion";
import { hoy } from "@/lib/fechas";
import { edad, PARENTESCOS, type Parentesco } from "@/lib/hogar";
import { jurisdiccion } from "@/lib/impuestos/registro";
import { quitarMiembro } from "../acciones";
import { FormularioPersona } from "../miembros/formularios";
import { PestanasConfiguracion } from "../pestanas";
import { FormularioAccion } from "@/components/ui/formulario-accion";

export const metadata = { title: "Personas a cargo" };

/**
 * Configuración → Personas a cargo: hijos, padres u otros familiares sin cuenta. Cuentan en el costo por persona,
 * le dan contexto al asistente y, si se marcan, aparecen como dependientes en Renta DIAN (art. 387 E.T.).
 */
export default async function Personas() {
  const ctx = await obtenerContexto(); // antes de hoy(): marca el render como dinámico
  const fecha = hoy();
  const { data: miembros } = await ctx.supabase
    .from("members")
    .select("id, nombre, rol, user_id, es_dependiente, parentesco, fecha_nacimiento, a_cargo_de, nota, dependiente_dian")
    .order("created_at");
  const todos = miembros ?? [];
  const adultos = todos.filter((m) => !m.es_dependiente);
  const aCargo = todos.filter((m) => m.es_dependiente);
  const nombreDe = new Map(todos.map((m) => [m.id, m.nombre]));
  const dependientes = jurisdiccion(ctx.hogar.pais)?.dependientes;
  const dian = aCargo.filter((p) => p.dependiente_dian).length;

  return (
    <>
      <Titulo
        subtitulo="Quienes dependen del hogar y cuáles cuentan como dependientes para la DIAN"
        accion={
          ctx.esAdmin && (
            <AccionPrincipal href="/ajustes/personas?nuevo=1" guia="agregar-persona">
              Agregar persona
            </AccionPrincipal>
          )
        }
      >
        Configuración
      </Titulo>
      <PestanasConfiguracion actual="/ajustes/personas" />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
        <Tarjeta
          titulo="Personas a cargo"
          subtitulo="Hijos, padres u otros familiares que dependen del hogar. Cuentan en el costo por persona y le dan contexto al asistente."
        >
          {aCargo.length ? (
            <ul className="divide-y divide-divisor">
              {aCargo.map((p) => {
                const anios = p.fecha_nacimiento ? edad(p.fecha_nacimiento, fecha) : null;
                const guia = dependientes?.orientacion({ parentesco: p.parentesco as Parentesco | null, edad: anios });
                const detalle = [
                  p.parentesco ? PARENTESCOS[p.parentesco as Parentesco] : null,
                  anios !== null ? `${anios} ${anios === 1 ? "año" : "años"}` : null,
                  p.a_cargo_de ? `a cargo de ${nombreDe.get(p.a_cargo_de) ?? "—"}` : null,
                ].filter(Boolean);
                return (
                  <li key={p.id} className="space-y-2 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span>
                        <span className="block font-medium">{p.nombre}</span>
                        <span className="text-sm text-tenue">{detalle.length ? detalle.join(" · ") : "Persona a cargo"}</span>
                        {p.nota && <span className="block text-sm text-cuerpo">{p.nota}</span>}
                      </span>
                      {p.dependiente_dian && <Chip tono="info">Dependiente DIAN</Chip>}
                    </div>
                    {guia && (
                      <p className="text-[13px] leading-[18px] text-cuerpo">
                        <b>¿Cuenta como dependiente para la DIAN?</b> {guia.texto}
                      </p>
                    )}
                    {ctx.esAdmin && (
                      <details className="rounded-xl bg-mosaico p-3">
                        <summary className="cursor-pointer text-sm font-semibold">Editar</summary>
                        <div className="mt-3 space-y-3">
                          <FormularioPersona persona={p} adultos={adultos} hoy={fecha} />
                          <FormularioAccion accion={quitarMiembro}>
                            <input type="hidden" name="id" value={p.id} />
                            <Boton type="submit" variante="peligro" className="min-h-9 w-full text-xs">
                              Quitar a {p.nombre}
                            </Boton>
                          </FormularioAccion>
                        </div>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <Vacio>Aún no hay personas a cargo.</Vacio>
          )}
        </Tarjeta>
        </div>
        <Tarjeta titulo="Dependientes para la DIAN" subtitulo={`${dian} de ${aCargo.length} marcadas`}>
          <div className="space-y-3 text-sm text-cuerpo">
            <p>
              Quien declara renta puede restar <b>10 % de sus ingresos laborales</b> (hasta 384 UVT al año) y <b>72 UVT más por cada dependiente</b>, hasta cuatro.
            </p>
            <p>Marca «Dependiente DIAN» en cada persona que cumpla las condiciones y elige a cargo de quién está: así aparece en Renta DIAN de esa persona.</p>
            <p className="text-[13px] text-tenue">Es orientativo: confírmalo con tu contador antes de declarar.</p>
          </div>
        </Tarjeta>
      </div>
      {ctx.esAdmin && (
        <Ventana titulo="Agregar persona a cargo" subtitulo="Hijos, padres u otros familiares que dependen del hogar" guia="persona">
          <FormularioPersona adultos={adultos} hoy={fecha} />
        </Ventana>
      )}
    </>
  );
}
