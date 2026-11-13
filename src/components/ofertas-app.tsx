import Link from "next/link";
import { Icono, type NombreIcono } from "@/components/marca";
import { PORQUE, recomendaciones } from "@/lib/academia/servidor";
import { BannerOferta } from "@/components/oferta";
import { obtenerContexto } from "@/lib/sesion";
import { cerrarOferta } from "./ofertas-accion";

type Oferta = { id: string; titulo: string; texto: string; etiqueta: string; boton_texto: string | null; tiene_enlace: boolean };

/**
 * Consola → Ofertas y enlaces: la oferta o aviso de este lugar para el hogar (según su plan y situación). El clic pasa
 * por /o/<id> (cuenta y redirige) y la «✕» la oculta para siempre a esta persona.
 */
export async function OfertaEnLugar({ lugar }: { lugar: string }) {
  const ctx = await obtenerContexto();
  const { data } = await ctx.supabase.rpc("mi_oferta", { p_lugar: lugar });
  const o = data as Oferta | null;
  if (!o) return null;
  return (
    <div className="mb-4">
      <BannerOferta
        etiqueta={o.etiqueta}
        titulo={o.titulo}
        texto={o.texto}
        boton={
          o.tiene_enlace && o.boton_texto ? (
            <a href={`/o/${o.id}`} className="inline-flex h-9 items-center rounded-lg bg-arena px-3 text-sm font-semibold text-monte hover:bg-arena/90">
              {o.boton_texto}
            </a>
          ) : null
        }
        cerrar={
          <form action={cerrarOferta}>
            <input type="hidden" name="id" value={o.id} />
            <button type="submit" aria-label="Cerrar" className="inline-flex size-9 items-center justify-center rounded-lg text-arena hover:bg-white/10">
              ✕
            </button>
          </form>
        }
      />
    </div>
  );
}

const ICONO = { dian: "declaracion-renta", bancos: "cuentas", simuladores: "ahorro", academia: "educacion", otros: "documentos" } as const;

/** Enlaces de interés del lugar (lectura por RLS: solo los activos). */
export async function EnlacesUtiles({ lugar, titulo = "Enlaces útiles" }: { lugar: string; titulo?: string }) {
  const ctx = await obtenerContexto();
  const { data } = await ctx.supabase.from("enlaces").select("id, titulo, fuente, categoria").eq("lugar", lugar).order("orden").order("titulo").limit(8);
  if (!data?.length) return null;
  return (
    <section aria-label={titulo} className="rounded-2xl border border-borde bg-elevada p-4 md:p-6">
      <h2 className="mb-2 text-[17px] font-bold md:text-xl">{titulo}</h2>
      <ul className="flex flex-col">
        {data.map((e) => (
          <li key={e.id}>
            <Link href={`/e/${e.id}`} prefetch={false} target="_blank" className="flex min-h-14 items-center gap-3 border-b border-divisor py-2 last:border-0 hover:bg-mosaico/60">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-mosaico">
                <Icono nombre={ICONO[e.categoria as keyof typeof ICONO] ?? "documentos"} tamano={18} />
              </span>
              <span className="flex min-w-0 flex-col">
                <b className="truncate text-sm">{e.titulo}</b>
                {e.fuente && <small className="text-[13px] text-tenue">{e.fuente}</small>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Recomendación de la Academia para este lugar (reglas de Consola → Academia según cómo va el hogar). */
export async function RecomendacionAcademia({ lugar }: { lugar: string }) {
  const ctx = await obtenerContexto();
  const [r] = await recomendaciones(ctx.supabase, lugar);
  if (!r) return null;
  return (
    <Link href={`/a/${r.id}`} prefetch={false} className="flex items-center gap-3.5 rounded-2xl border border-borde bg-elevada p-4 hover:bg-arena">
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-mosaico">
        <Icono nombre={r.icono as NombreIcono} tamano={22} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs font-bold tracking-[0.04em] text-cuerpo uppercase">Academia · {PORQUE[r.condicion] ?? "para ti"}</span>
        <b className="text-[15px] leading-5">{r.leccion_titulo ?? r.ruta_titulo}</b>
        {r.minutos ? <span className="text-[13px] text-tenue">{r.minutos} min de lectura</span> : null}
      </span>
      <span className="text-sm font-semibold">Leer</span>
    </Link>
  );
}
