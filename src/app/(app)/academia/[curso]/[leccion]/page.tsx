import Link from "next/link";
import { notFound } from "next/navigation";
import { Barra, clasesBoton, cx } from "@/components/ui";
import { Icono } from "@/components/marca";
import { BotonGuia } from "@/components/guia/boton-guia";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioEstado } from "@/components/ui/formulario-estado";
import { obtenerContexto, obtenerUsuario } from "@/lib/sesion";
import { avanceCurso, claveLeccion, leccionDe, leerVistasAcademia, type Bloque } from "@/lib/academia";
import { guiaPorId } from "@/lib/guias";
import { marcarLeccion } from "../../acciones";
import { Repaso } from "./repaso";

export async function generateMetadata({ params }: PageProps<"/academia/[curso]/[leccion]">) {
  const { curso, leccion } = await params;
  return { title: leccionDe(curso, leccion)?.leccion.titulo ?? "Academia" };
}

/** Lección (diseño «Lección»): temario con avance a la izquierda y la lectura con su repaso a la derecha. */
export default async function Leccion({ params }: PageProps<"/academia/[curso]/[leccion]">) {
  const p = await params;
  const l = leccionDe(p.curso, p.leccion);
  if (!l) notFound();
  const [ctx, { user }] = await Promise.all([obtenerContexto(), obtenerUsuario()]);
  const vistas = new Set(leerVistasAcademia(user.user_metadata));
  const a = avanceCurso(l.curso, vistas);
  const vista = vistas.has(claveLeccion(l.curso.slug, l.leccion.slug));

  return (
    <div className="flex flex-col gap-4">
      <Link href="/academia" className="text-sm font-semibold text-cuerpo hover:underline">
        ← Academia · {l.curso.titulo}
      </Link>
      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="order-2 flex flex-col gap-3 lg:order-1">
          <nav aria-label="Lecciones del curso" className="rounded-2xl border border-borde bg-elevada p-2">
            {l.curso.lecciones.map((x, i) => {
              const hecha = vistas.has(claveLeccion(l.curso.slug, x.slug));
              const actual = x.slug === l.leccion.slug;
              return (
                <Link
                  key={x.slug}
                  href={`/academia/${l.curso.slug}/${x.slug}`}
                  aria-current={actual ? "page" : undefined}
                  className={cx("flex items-center gap-2.5 rounded-[10px] p-2.5 text-sm leading-[19px]", actual ? "bg-seleccion font-bold" : "hover:bg-mosaico")}
                >
                  <span
                    className={cx(
                      "inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold",
                      hecha ? "border-ok bg-ok text-white" : actual ? "border-monte bg-monte text-arena" : "border-control",
                    )}
                  >
                    {hecha ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M5 12l5 5 9-10" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </span>
                  {x.titulo}
                </Link>
              );
            })}
          </nav>
          <Barra porcentaje={a.porcentaje} tono="marca" />
          <span className="text-[13px] text-tenue">
            {a.hechas} de {a.total} lecciones{a.faltanMinutos ? ` · ${a.faltanMinutos} min restantes` : " · completo"}
          </span>
        </aside>

        <article className="order-1 flex max-w-[760px] flex-col gap-[18px] lg:order-2">
          <p className="text-xs leading-4 font-bold tracking-[0.12em] uppercase">
            Lección {l.indice + 1} de {l.curso.lecciones.length} · {l.leccion.minutos} min de lectura
          </p>
          <h1 className="text-[26px] leading-8 font-bold md:text-[34px] md:leading-10">{l.leccion.titulo}</h1>
          {l.leccion.bloques.map((b, i) => (
            <Bloque key={i} b={b} contador={ctx.miembro.rol === "contador"} />
          ))}
          <div className="flex flex-wrap justify-between gap-2.5 pt-2">
            {l.anterior ? (
              <Link href={`/academia/${l.curso.slug}/${l.anterior.slug}`} className={clasesBoton("fantasma")}>
                ← Lección {l.indice}
              </Link>
            ) : (
              <span />
            )}
            <FormularioEstado accion={marcarLeccion} className="flex flex-col items-end gap-2">
              <input type="hidden" name="curso" value={l.curso.slug} />
              <input type="hidden" name="leccion" value={l.leccion.slug} />
              <BotonEnviar pendiente="Guardando…">
                {l.siguiente ? (vista ? "Seguir →" : "Marcar como vista y seguir →") : vista ? "Volver a la Academia" : "Marcar como vista y terminar"}
              </BotonEnviar>
            </FormularioEstado>
          </div>
        </article>
      </div>
    </div>
  );
}

/** Un bloque de la lectura. Las guías de registrar se ocultan al contador (su rol es de solo lectura). */
function Bloque({ b, contador }: { b: Bloque; contador: boolean }) {
  if ("p" in b) return <p className="text-[17px] leading-7 text-[#2d3a36]">{b.p}</p>;
  if ("h2" in b) return <h2 className="mt-2 text-[22px] leading-7 font-bold">{b.h2}</h2>;
  if ("opciones" in b)
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {b.opciones.map((o) => (
          <div key={o.titulo} className="rounded-[14px] border border-borde bg-elevada p-4 text-sm leading-[21px] text-cuerpo">
            <b className="mb-1 block text-base text-tinta">{o.titulo}</b>
            {o.texto}
          </div>
        ))}
      </div>
    );
  if ("aplica" in b)
    return (
      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-monte px-5 py-[18px] text-arena">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#1b4a3e]">
          <Icono nombre="meta" tamano={22} />
        </span>
        <span className="min-w-[200px] flex-1">
          <b className="text-[17px]">{b.aplica.titulo}</b>
          <br />
          <span className="text-sm text-sobre-monte">{b.aplica.texto}</span>
        </span>
        <Link href={b.aplica.href} className={clasesBoton("secundario", "border-arena bg-arena text-monte hover:bg-arena/90")}>
          {b.aplica.boton}
        </Link>
      </div>
    );
  if ("guia" in b) {
    const g = guiaPorId(b.guia.id);
    if (!g || (contador && g.para !== "todos")) return null;
    return (
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-borde bg-elevada px-5 py-[18px]">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-mosaico">
          <Icono nombre={g.icono} tamano={22} />
        </span>
        <span className="min-w-[200px] flex-1">
          <b className="text-[17px]">Hazlo con la guía: {g.titulo.toLowerCase()}</b>
          <br />
          <span className="text-sm text-cuerpo">{b.guia.texto}</span>
        </span>
        <BotonGuia id={g.id} compacto={false} variante="primario">
          Empezar la guía
        </BotonGuia>
      </div>
    );
  }
  return <Repaso {...b.quiz} />;
}
