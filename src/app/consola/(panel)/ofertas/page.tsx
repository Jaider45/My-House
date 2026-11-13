import type { Metadata } from "next";
import Link from "next/link";
import { Aviso, Chip, Titulo, clasesBoton, cx, type Tono } from "@/components/ui";
import { Icono } from "@/components/marca";
import { BannerOferta } from "@/components/oferta";
import { obtenerStaff } from "@/lib/consola/sesion";
import { formatearFechaCorta } from "@/lib/consola/formato";
import { hoy } from "@/lib/fechas";
import { AUDIENCIAS, CATEGORIAS_ENLACE, ESTADOS_ALIADO, LUGARES_ENLACE, LUGARES_OFERTA, TIPOS_ALIADO, nombreDe } from "@/lib/ofertas/constantes";
import { TarjetaTabla } from "../tarjeta-tabla";
import { VentanasOfertas, type Aliado, type Enlace, type Oferta } from "./formularios";

export const metadata: Metadata = { title: "Ofertas y enlaces" };

type OfertaFila = Oferta & { vistas: number; clics: number };
type EnlaceFila = Enlace & { clics_30d: number };
type AliadoFila = Aliado & { usos: number | null };

const PESTANAS = [
  ["ofertas", "Ofertas y avisos"],
  ["enlaces", "Enlaces de interés"],
  ["aliados", "Aliados"],
] as const;

const fechaCorta = (f: string) => formatearFechaCorta(`${f}T12:00:00-05:00`);

function estadoOferta(o: OfertaFila, hoyBogota: string): { texto: string; tono: Tono } {
  if (!o.publicada) return { texto: "Borrador", tono: "info" };
  if (o.desde > hoyBogota) return { texto: "Programada", tono: "alerta" };
  if (o.hasta && o.hasta < hoyBogota) return { texto: "Terminó", tono: "neutro" };
  return { texto: "Activa", tono: "ok" };
}

const ICONO_CATEGORIA = { dian: "declaracion-renta", bancos: "cuentas", simuladores: "ahorro", academia: "educacion", otros: "documentos" } as const;

export default async function Ofertas({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const staff = await obtenerStaff();
  const pedida = (await searchParams).tab;
  const tab = PESTANAS.find(([k]) => k === pedida)?.[0] ?? "ofertas";
  const { data, error } = await staff.supabase.rpc("consola_ofertas");
  const hoyBogota = hoy();
  const d = (data ?? { ofertas: [], enlaces: [], aliados: [], cupones: [] }) as { ofertas: OfertaFila[]; enlaces: EnlaceFila[]; aliados: AliadoFila[]; cupones: string[] };
  const puede = staff.puede("contenido_app");
  const muestra = d.ofertas.find((o) => estadoOferta(o, hoyBogota).texto === "Activa") ?? d.ofertas[0];
  const nuevo = tab === "ofertas" ? "oferta" : tab === "enlaces" ? "enlace" : "aliado";
  const editar = (valor: string) =>
    puede ? (
      <Link href={`?tab=${tab}&nuevo=${valor}`} scroll={false} className={clasesBoton("fantasma", "h-8 px-3 text-sm")}>
        Editar
      </Link>
    ) : null;

  return (
    <>
      <Titulo
        registrar={false}
        subtitulo="Avisos, ofertas, enlaces útiles y aliados que aparecen en la app"
        accion={
          puede ? (
            <Link href={`?tab=${tab}&nuevo=${nuevo}`} scroll={false} className={clasesBoton("primario")}>
              {tab === "ofertas" ? "Nueva oferta" : tab === "enlaces" ? "Nuevo enlace" : "Nuevo aliado"}
            </Link>
          ) : undefined
        }
      >
        Ofertas y enlaces
      </Titulo>
      {error && <Aviso>No se pudieron cargar: {error.message}</Aviso>}
      <nav role="tablist" aria-label="Secciones" className="mb-4 flex gap-1 overflow-x-auto border-b border-divisor">
        {PESTANAS.map(([k, t]) => (
          <Link
            key={k}
            role="tab"
            aria-selected={tab === k}
            href={`/consola/ofertas?tab=${k}`}
            className={cx("h-10 shrink-0 border-b-2 px-3 pt-2 text-sm font-semibold", tab === k ? "border-monte text-tinta" : "border-transparent text-cuerpo hover:text-tinta")}
          >
            {t}
          </Link>
        ))}
      </nav>

      {tab === "ofertas" && (
        <div className="grid items-start gap-5 xl:grid-cols-3">
          <TarjetaTabla titulo="Ofertas y avisos en la app" subtitulo="Banners que ven los usuarios según dónde estén" className="xl:col-span-2">
            <table className="tabla">
              <thead>
                <tr>
                  <th className="pl-4! md:pl-6!">Oferta o aviso</th>
                  <th>Dónde aparece</th>
                  <th>A quién</th>
                  <th>Fechas</th>
                  <th className="der">Vistas</th>
                  <th className="der">Clics</th>
                  <th>Estado</th>
                  <th className="pr-4! md:pr-6!">
                    <span className="sr-only">Editar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.ofertas.length === 0 && (
                  <tr>
                    <td colSpan={8} className="pl-4! text-tenue md:pl-6!">
                      Aún no hay ofertas.
                    </td>
                  </tr>
                )}
                {d.ofertas.map((o) => {
                  const e = estadoOferta(o, hoyBogota);
                  return (
                    <tr key={o.id}>
                      <td className="pl-4! font-semibold whitespace-normal! md:pl-6!">{o.titulo}</td>
                      <td className="text-cuerpo">{nombreDe(LUGARES_OFERTA, o.lugar)}</td>
                      <td className="text-cuerpo">{nombreDe(AUDIENCIAS, o.audiencia)}</td>
                      <td className="text-cuerpo">{o.hasta ? `${fechaCorta(o.desde)} – ${fechaCorta(o.hasta)}` : `Desde ${fechaCorta(o.desde)}`}</td>
                      <td className="der">{o.vistas.toLocaleString("es-CO")}</td>
                      <td className="der">{o.clics ? o.clics.toLocaleString("es-CO") : "—"}</td>
                      <td>
                        <Chip tono={e.tono}>{e.texto}</Chip>
                      </td>
                      <td className="pr-4! md:pr-6!">{editar(`oferta-${o.id}`)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TarjetaTabla>
          <section className="flex flex-col gap-3 rounded-2xl border border-borde bg-elevada p-4 md:p-6">
            <b>Así se ve en la app</b>
            <div className="rounded-2xl bg-mosaico p-3.5">
              {muestra ? (
                <BannerOferta
                  etiqueta={muestra.etiqueta}
                  titulo={muestra.titulo}
                  texto={muestra.texto}
                  boton={muestra.boton_texto ? <span className="inline-flex h-9 items-center rounded-lg bg-arena px-3 text-sm font-semibold text-monte">{muestra.boton_texto}</span> : null}
                />
              ) : (
                <p className="text-sm text-tenue">Crea una oferta para verla aquí.</p>
              )}
            </div>
            <span className="text-[13px] text-tenue">
              {muestra ? `Aparece en ${nombreDe(LUGARES_OFERTA, muestra.lugar)}, arriba del contenido. ` : ""}Se oculta si la persona la cierra. Se muestra una por pantalla: la más reciente
              que le aplica.
            </span>
          </section>
        </div>
      )}

      {tab === "enlaces" && (
        <TarjetaTabla titulo="Enlaces de interés" subtitulo="Atajos útiles que aparecen dentro de la app">
          <table className="tabla">
            <thead>
              <tr>
                <th className="pl-4! md:pl-6!">Enlace</th>
                <th>Categoría</th>
                <th>Dónde aparece</th>
                <th className="der">Clics · 30 d</th>
                <th>Estado</th>
                <th className="pr-4! md:pr-6!">
                  <span className="sr-only">Editar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {d.enlaces.map((e) => (
                <tr key={e.id}>
                  <td className="pl-4! md:pl-6!">
                    <span className="flex items-center gap-3">
                      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-mosaico">
                        <Icono nombre={ICONO_CATEGORIA[e.categoria as keyof typeof ICONO_CATEGORIA] ?? "documentos"} tamano={18} />
                      </span>
                      <span className="flex flex-col whitespace-normal">
                        <b>{e.titulo}</b>
                        <small className="text-[13px] text-tenue">{e.fuente || e.url}</small>
                      </span>
                    </span>
                  </td>
                  <td>
                    <Chip tono="neutro">{nombreDe(CATEGORIAS_ENLACE, e.categoria)}</Chip>
                  </td>
                  <td className="text-cuerpo">{nombreDe(LUGARES_ENLACE, e.lugar)}</td>
                  <td className="der">{e.clics_30d.toLocaleString("es-CO")}</td>
                  <td>
                    <Chip tono={e.activo ? "ok" : "neutro"}>{e.activo ? "Visible" : "Oculto"}</Chip>
                  </td>
                  <td className="pr-4! md:pr-6!">{editar(`enlace-${e.id}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TarjetaTabla>
      )}

      {tab === "aliados" && (
        <TarjetaTabla titulo="Aliados" subtitulo="Empresas que dan beneficios a los hogares de My House">
          <table className="tabla">
            <thead>
              <tr>
                <th className="pl-4! md:pl-6!">Aliado</th>
                <th>Tipo</th>
                <th>Beneficio para el hogar</th>
                <th className="der">Hogares que lo usaron</th>
                <th>Estado</th>
                <th className="pr-4! md:pr-6!">
                  <span className="sr-only">Editar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {d.aliados.length === 0 && (
                <tr>
                  <td colSpan={6} className="pl-4! text-tenue md:pl-6!">
                    Aún no hay aliados.
                  </td>
                </tr>
              )}
              {d.aliados.map((a) => (
                <tr key={a.id}>
                  <td className="pl-4! font-semibold md:pl-6!">{a.nombre}</td>
                  <td>
                    <Chip tono="neutro">{nombreDe(TIPOS_ALIADO, a.tipo)}</Chip>
                  </td>
                  <td className="text-cuerpo whitespace-normal!">
                    {a.beneficio}
                    {a.cupon ? ` · cupón ${a.cupon}` : ""}
                  </td>
                  <td className="der" title={a.cupon ? "Hogares que usaron su cupón" : "Sin cupón: no se puede contar"}>
                    {a.usos ?? "—"}
                  </td>
                  <td>
                    <Chip tono={a.estado === "activo" ? "ok" : a.estado === "pausado" ? "neutro" : "info"}>{nombreDe(ESTADOS_ALIADO, a.estado)}</Chip>
                  </td>
                  <td className="pr-4! md:pr-6!">{editar(`aliado-${a.id}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TarjetaTabla>
      )}

      {puede && <VentanasOfertas ofertas={d.ofertas} enlaces={d.enlaces} aliados={d.aliados} cupones={d.cupones} />}
    </>
  );
}
