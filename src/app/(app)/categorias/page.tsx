import Link from "next/link";
import { Suspense } from "react";
import { Boton, Cargando, Tarjeta, Titulo } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { construirArbol, type Categoria } from "@/lib/categorias";
import { archivarCategoria } from "./acciones";
import { BotonEliminarCategoria, FormularioCategoria } from "./formulario";

export const metadata = { title: "Categorías" };

export default function Categorias({ searchParams }: PageProps<"/categorias">) {
  return (
    <>
      <Titulo>Categorías</Titulo>
      <Suspense fallback={<Cargando />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function Etiquetas({ c }: { c: Categoria }) {
  return (
    <span className="flex flex-wrap gap-1 text-[11px]">
      <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">{c.tipo}</span>
      {c.es_esencial && <span className="rounded-full bg-teal-100 px-2 py-0.5 text-teal-800 dark:bg-teal-950 dark:text-teal-200">esencial</span>}
      {c.excluir_de_costo_vida && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-950 dark:text-amber-200">no es costo de vida</span>}
      {c.archivada && <span className="rounded-full bg-zinc-200 px-2 py-0.5 dark:bg-zinc-700">archivada</span>}
    </span>
  );
}

function Editar({ c, puedeEditar }: { c: Categoria; puedeEditar: boolean }) {
  if (!puedeEditar) return null;
  return (
    <div className="mt-3 space-y-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950">
      <FormularioCategoria categoria={c} clase={c.clase} />
      <form action={archivarCategoria}>
        <input type="hidden" name="id" value={c.id} />
        <input type="hidden" name="archivar" value={c.archivada ? "0" : "1"} />
        <Boton type="submit" variante="secundario" className="w-full">
          {c.archivada ? "Reactivar" : "Archivar"}
        </Boton>
      </form>
      <BotonEliminarCategoria id={c.id} />
    </div>
  );
}

async function Contenido({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const clase: Categoria["clase"] = (await searchParams).clase === "ingreso" ? "ingreso" : "gasto";
  const ctx = await obtenerContexto();
  const { data } = await ctx.supabase
    .from("categories")
    .select("id, nombre, padre_id, clase, tipo, es_esencial, excluir_de_costo_vida, archivada")
    .eq("clase", clase);
  const arbol = construirArbol(data ?? []);

  const pestana = (valor: Categoria["clase"], texto: string) => (
    <Link
      href={valor === "gasto" ? "/categorias" : "/categorias?clase=ingreso"}
      className={`flex-1 rounded-lg py-2 text-center text-sm font-semibold ${
        clase === valor ? "bg-white shadow dark:bg-zinc-800" : "text-zinc-500"
      }`}
    >
      {texto}
    </Link>
  );

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
        {pestana("gasto", "Gastos")}
        {pestana("ingreso", "Ingresos")}
      </nav>

      <Tarjeta>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {arbol.map((raiz) => (
            <li key={raiz.id} className={`py-2 ${raiz.archivada ? "opacity-50" : ""}`}>
              <details>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                  <span className="font-medium">{raiz.nombre}</span>
                  <Etiquetas c={raiz} />
                </summary>
                <Editar c={raiz} puedeEditar={ctx.puedeEditar} />
              </details>

              {raiz.hijas.length > 0 && (
                <ul className="mt-1 ml-4 border-l border-zinc-200 pl-3 dark:border-zinc-800">
                  {raiz.hijas.map((h) => (
                    <li key={h.id} className={`py-1 ${h.archivada ? "opacity-50" : ""}`}>
                      <details>
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm">
                          <span>{h.nombre}</span>
                          <Etiquetas c={h} />
                        </summary>
                        <Editar c={h} puedeEditar={ctx.puedeEditar} />
                      </details>
                    </li>
                  ))}
                </ul>
              )}

              {ctx.puedeEditar && !raiz.archivada && (
                <details className="mt-1 ml-4">
                  <summary className="cursor-pointer text-xs font-semibold text-teal-700">+ Subcategoría</summary>
                  <div className="mt-2">
                    <FormularioCategoria clase={clase} padre={raiz} />
                  </div>
                </details>
              )}
            </li>
          ))}
        </ul>
      </Tarjeta>

      {ctx.puedeEditar && (
        <Tarjeta titulo={`Nueva categoría de ${clase === "gasto" ? "gasto" : "ingreso"}`}>
          <FormularioCategoria clase={clase} />
        </Tarjeta>
      )}
    </div>
  );
}
