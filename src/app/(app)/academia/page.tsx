import Link from "next/link";
import { Aviso, Barra, Chip, Titulo, clasesBoton, cx } from "@/components/ui";
import { Icono, type NombreIcono } from "@/components/marca";
import { BotonGuia } from "@/components/guia/boton-guia";
import { obtenerContexto, obtenerUsuario } from "@/lib/sesion";
import { hoy } from "@/lib/fechas";
import { cargarSemaforo } from "@/lib/impuestos/servidor";
import { guiasPara, leerVistas } from "@/lib/guias";
import { CURSOS, GLOSARIO, TEMAS, avanceCurso, buscar, continuar, cursoPorSlug, leerVistasAcademia, type Curso, type Tema } from "@/lib/academia";
import { OfertaEnLugar } from "@/components/ofertas-app";

export const metadata = { title: "Academia" };

const COLOR_PORTADA: Record<Curso["color"], string> = {
  monte: "bg-monte text-arena",
  teja: "bg-[#b9502e] text-arena",
  mar: "bg-[#2c5a4d] text-arena",
  arena: "bg-[#e9dccb] text-monte",
};

const FILTROS: { id: string; texto: string }[] = [
  { id: "", texto: "Todo" },
  { id: "guias", texto: "Guías paso a paso" },
  ...(Object.keys(TEMAS) as Tema[]).map((t) => ({ id: t, texto: TEMAS[t] })),
  { id: "glosario", texto: "Glosario" },
];

type Recomendacion = { porque: string; titulo: string; detalle: string; href: string; icono: NombreIcono };

/** Academia (diseño «Academia»): rutas de lecciones escritas, guías interactivas, recomendaciones y glosario. */
export default async function Academia({ searchParams }: PageProps<"/academia">) {
  const [ctx, { user }, sp] = await Promise.all([obtenerContexto(), obtenerUsuario(), searchParams]);
  const fecha = hoy();
  const tema = typeof sp.tema === "string" ? sp.tema : "";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const terminado = typeof sp.terminado === "string" ? cursoPorSlug(sp.terminado) : undefined;
  const vistas = new Set(leerVistasAcademia(user.user_metadata));
  const guiasVistas = new Set(leerVistas(user.user_metadata));

  // Recomendaciones según cómo va el hogar (consultas pequeñas, en paralelo).
  const [semaforo, { count: deudas }, { data: emergencia }] = await Promise.all([
    cargarSemaforo(ctx, Number(fecha.slice(0, 4))),
    ctx.supabase.from("debts").select("id", { count: "exact", head: true }).eq("archivada", false),
    ctx.supabase.from("budgets_goals").select("id").eq("tipo", "meta").eq("es_emergencia", true).limit(1),
  ]);
  const recomendaciones: Recomendacion[] = [];
  if (semaforo.ok) {
    const obligada = semaforo.personas.find((p) => p.estado === "rojo") ?? semaforo.personas.find((p) => p.estado === "amarillo");
    if (obligada)
      recomendaciones.push({
        porque: obligada.estado === "rojo" ? `Porque ${obligada.nombre.split(" ")[0]} debe declarar en ${semaforo.anio + 1}` : `Porque ${obligada.nombre.split(" ")[0]} está cerca de un tope`,
        titulo: "Los soportes que debes guardar desde enero",
        detalle: "Lección · 4 min",
        href: "/academia/renta/soportes",
        icono: "declaracion-renta",
      });
  }
  if (!emergencia?.length)
    recomendaciones.push({ porque: "Porque aún no tienes fondo de emergencia", titulo: "¿Cuánto debe tener tu fondo de emergencia?", detalle: "Lección · 4 min", href: "/academia/ahorro/cuanto-fondo", icono: "ahorro" });
  if ((deudas ?? 0) > 1)
    recomendaciones.push({ porque: `Porque tienes ${deudas} deudas`, titulo: "Bola de nieve o avalancha: cuál pagar primero", detalle: "Lección · 4 min", href: "/academia/deudas/bola-de-nieve-o-avalancha", icono: "deducciones" });
  if (recomendaciones.length < 3)
    recomendaciones.push({ porque: "Para empezar", titulo: "¿Qué es el número mínimo del hogar?", detalle: "Lección · 3 min", href: "/academia/finanzas/numero-minimo", icono: "casa" });

  const seguir = continuar(vistas);
  const cursos = tema && tema in TEMAS ? CURSOS.filter((c) => c.tema === tema) : CURSOS;
  const resultados = q ? buscar(q) : [];
  const verCursos = !q && tema !== "glosario" && tema !== "guias";
  const verGuias = !q && (tema === "" || tema === "guias" || tema === "app");
  const verGlosario = !q && (tema === "" || tema === "glosario");
  const guias = guiasPara(ctx.miembro.rol);

  return (
    <>
      <Titulo subtitulo="Aprende a usar My House y a manejar mejor la plata de la casa">Academia</Titulo>
      <OfertaEnLugar lugar="academia" />
      <div className="flex flex-col gap-5">
        {terminado && <Aviso tipo="ok">¡Terminaste «{terminado.titulo}»! Sigue con otra ruta cuando quieras.</Aviso>}

        <section className="grid grid-cols-1 items-center gap-5 rounded-[20px] border border-[#efe7db] bg-arena p-5 md:p-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-7">
          <div className="flex flex-col gap-3.5">
            <p className="text-xs leading-4 font-bold tracking-[0.12em] uppercase">Academia My House</p>
            <h2 className="text-[26px] leading-8 font-bold md:text-[34px] md:leading-10">Aprende a manejar la plata de la casa, a tu ritmo.</h2>
            <p className="text-base leading-[25px] text-cuerpo">
              Lecciones cortas y guías paso a paso sobre la app y sobre las finanzas del hogar en Colombia. Gratis en todos los planes.
            </p>
            <form action="/academia" className="relative flex max-w-[460px] items-center">
              <span className="pointer-events-none absolute left-3 text-tenue">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
              </span>
              <input
                type="search"
                name="q"
                defaultValue={q}
                aria-label="Buscar en la Academia"
                placeholder="Busca: fondo de emergencia, UVT, presupuesto…"
                className="h-11 w-full rounded-lg border border-control bg-elevada pr-3 pl-10 text-[15px] outline-none focus:border-monte"
              />
            </form>
          </div>
          {seguir ? (
            <Link href={`/academia/${seguir.curso.slug}/${seguir.siguiente!.slug}`} className="flex flex-col gap-3 rounded-2xl border border-borde bg-elevada p-[18px] text-tinta">
              <span className="text-[13px] text-tenue">Sigue donde ibas</span>
              <b className="text-lg leading-6">
                {seguir.curso.titulo} · Lección {seguir.curso.lecciones.indexOf(seguir.siguiente!) + 1}: {seguir.siguiente!.titulo}
              </b>
              <Barra porcentaje={seguir.porcentaje} tono="marca" gruesa />
              <span className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-tenue">
                  {seguir.hechas} de {seguir.total} lecciones · faltan {seguir.faltanMinutos} min
                </span>
                <span className={clasesBoton("primario", "h-9 px-3 text-sm")}>Continuar</span>
              </span>
            </Link>
          ) : (
            <Link href="/academia/empieza/registrar" className="flex flex-col gap-3 rounded-2xl border border-borde bg-elevada p-[18px] text-tinta">
              <span className="text-[13px] text-tenue">Empieza por aquí</span>
              <b className="text-lg leading-6">Empieza con My House · Lección 1: Registra un gasto en 10 segundos</b>
              <Barra porcentaje={0} tono="marca" gruesa />
              <span className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-tenue">5 lecciones · 12 min</span>
                <span className={clasesBoton("primario", "h-9 px-3 text-sm")}>Empezar</span>
              </span>
            </Link>
          )}
        </section>

        <nav aria-label="Temas" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {FILTROS.map((f) => (
            <Link
              key={f.id}
              href={f.id ? `/academia?tema=${f.id}` : "/academia"}
              aria-current={tema === f.id && !q ? "page" : undefined}
              className={cx(
                "inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-sm whitespace-nowrap",
                tema === f.id && !q ? "border-monte bg-monte text-arena" : "border-control bg-elevada text-tinta hover:bg-mosaico",
              )}
            >
              {f.texto}
            </Link>
          ))}
        </nav>

        {q && (
          <section className="flex flex-col gap-2.5">
            <Encabezado titulo={`Resultados para «${q}»`} detalle={`${resultados.length} ${resultados.length === 1 ? "lección" : "lecciones"}`} />
            {resultados.length ? (
              resultados.map(({ curso, leccion }) => (
                <Link key={`${curso.slug}/${leccion.slug}`} href={`/academia/${curso.slug}/${leccion.slug}`} className="flex items-center gap-3.5 rounded-2xl border border-borde bg-elevada p-4 hover:bg-arena">
                  <Cuadro icono={curso.icono} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold tracking-[0.04em] text-cuerpo uppercase">{curso.titulo}</span>
                    <b className="text-base leading-[22px]">{leccion.titulo}</b>
                  </span>
                  <span className="text-[13px] text-tenue">{leccion.minutos} min</span>
                </Link>
              ))
            ) : (
              <p className="text-sm text-tenue">No encontramos lecciones con esas palabras. Prueba con «presupuesto», «UVT» o «deudas».</p>
            )}
          </section>
        )}

        {!q && !tema && (
          <section className="flex flex-col gap-2.5">
            <Encabezado titulo="Recomendado para ti" detalle="Según cómo va tu hogar" />
            {recomendaciones.slice(0, 3).map((r) => (
              <Link key={r.href} href={r.href} className="flex items-start gap-3.5 rounded-2xl border border-borde bg-elevada p-4 hover:bg-arena">
                <Cuadro icono={r.icono} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-xs font-bold tracking-[0.04em] text-cuerpo uppercase">{r.porque}</span>
                  <b className="text-base leading-[22px]">{r.titulo}</b>
                  <span className="text-[13px] text-tenue">{r.detalle}</span>
                </span>
                <span className={clasesBoton("secundario", "h-9 shrink-0 self-center px-3 text-sm")}>Leer</span>
              </Link>
            ))}
          </section>
        )}

        {verCursos && cursos.length > 0 && (
          <section className="flex flex-col gap-3">
            <Encabezado titulo="Rutas de aprendizaje" detalle={`${cursos.length} ${cursos.length === 1 ? "curso escrito" : "cursos escritos"}`} />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-3">
              {cursos.map((c) => {
                const a = avanceCurso(c, vistas);
                return (
                  <Link key={c.slug} href={`/academia/${c.slug}`} className="flex flex-col gap-3 rounded-[18px] border border-borde bg-elevada p-5 text-tinta hover:border-control">
                    <span className={cx("flex aspect-[16/8] items-end rounded-[14px] p-3.5", COLOR_PORTADA[c.color])}>
                      <b className="max-w-[80%] text-[15px] leading-5">{c.portada}</b>
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-[13px] text-cuerpo">
                      <Chip plano>{TEMAS[c.tema]}</Chip>
                      {c.lecciones.length} lecciones · {c.lecciones.reduce((s, l) => s + l.minutos, 0)} min
                    </span>
                    <b className="text-[17px] leading-[23px]">{c.titulo}</b>
                    <span className="text-sm leading-[21px] text-cuerpo">{c.descripcion}</span>
                    <span className="mt-auto flex flex-col gap-1.5">
                      {a.hechas > 0 && <Barra porcentaje={a.porcentaje} tono={a.completo ? "ok" : "marca"} />}
                      <span className="text-[13px] text-tenue">{a.completo ? "Completado" : a.hechas ? `${a.hechas} de ${a.total}` : "Sin empezar"}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {verGuias && (
          <section id="guias" className="flex scroll-mt-4 flex-col gap-3">
            <Encabezado titulo="Guías paso a paso" detalle="Te ilumino la pantalla y te digo dónde tocar" />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {guias.map((g) => (
                <div key={g.id} className="flex items-center gap-3 rounded-[14px] border border-borde bg-elevada px-4 py-3.5">
                  <Cuadro icono={g.icono} />
                  <span className="min-w-0 flex-1">
                    <b className="block text-[15px] leading-5">{g.titulo}</b>
                    <span className="flex items-center gap-2 text-[13px] text-tenue">
                      {g.pasos.length} pasos
                      {guiasVistas.has(g.id) && <Chip tono="ok">Hecha</Chip>}
                    </span>
                  </span>
                  <BotonGuia id={g.id} compacto={false} variante={guiasVistas.has(g.id) ? "secundario" : "primario"} className="h-9 px-3 text-sm">
                    {guiasVistas.has(g.id) ? "Repetir" : "Empezar"}
                  </BotonGuia>
                </div>
              ))}
            </div>
          </section>
        )}

        {verGlosario && (
          <section aria-label="Glosario" className="rounded-2xl border border-borde bg-elevada p-4 md:p-6">
            <h2 className="text-[17px] leading-[22px] font-bold md:text-xl md:leading-[26px]">Glosario</h2>
            <p className="mt-0.5 mb-4 text-sm text-tenue">Las palabras de la plata, en simple</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {GLOSARIO.map((g) => (
                <div key={g.termino} className="rounded-[14px] border border-borde px-4 py-3.5 text-sm leading-[21px] text-cuerpo">
                  <b className="mb-0.5 block text-[15px] text-tinta">{g.termino}</b>
                  {g.texto}
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="text-[13px] text-tenue">Contenido educativo. No reemplaza la asesoría de un contador o asesor financiero.</p>
      </div>
    </>
  );
}

function Encabezado({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-lg leading-6 font-bold">{titulo}</h2>
      <span className="text-sm text-cuerpo">{detalle}</span>
    </div>
  );
}

function Cuadro({ icono }: { icono: NombreIcono }) {
  return (
    <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-mosaico">
      <Icono nombre={icono} tamano={22} />
    </span>
  );
}
