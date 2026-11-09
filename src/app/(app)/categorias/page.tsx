import Link from "next/link";
import { Boton, Tarjeta, Titulo } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { construirArbol, type Categoria } from "@/lib/categorias";
import { archivarCategoria } from "./acciones";
import { BotonEliminarCategoria, FormularioCategoria } from "./formulario";
import { PestanasConfiguracion } from "@/app/(app)/ajustes/pestanas";
import { FormularioAccion } from "@/components/ui/formulario-accion";

export const metadata = { title: "Categorías" };

export default function Categorias({ searchParams }: PageProps<"/categorias">) {
  return (
    <>
      <Titulo subtitulo="El hogar, quién entra, con qué cuentas y con qué valores">Configuración</Titulo>
      <PestanasConfiguracion actual="/categorias" />
      <Contenido searchParams={searchParams} />
    </>
  );
}

function Etiquetas({ c }: { c: Categoria }) {
  return (
    <span className="flex flex-wrap gap-1 text-[11px]">
      <span className="rounded-full bg-mosaico px-2 py-0.5">{c.tipo}</span>
      {c.es_esencial && <span className="rounded-full bg-seleccion px-2 py-0.5 text-tinta">esencial</span>}
      {c.excluir_de_costo_vida && <span className="rounded-full bg-alerta-fondo px-2 py-0.5 text-alerta-tinta">no es costo de vida</span>}
      {c.archivada && <span className="rounded-full bg-pista px-2 py-0.5">archivada</span>}
    </span>
  );
}

function Editar({ c, puedeEditar }: { c: Categoria; puedeEditar: boolean }) {
  if (!puedeEditar) return null;
  return (
    <div className="mt-3 space-y-3 rounded-xl bg-mosaico p-3">
      <FormularioCategoria categoria={c} clase={c.clase} />
      <FormularioAccion accion={archivarCategoria}>
        <input type="hidden" name="id" value={c.id} />
        <input type="hidden" name="archivar" value={c.archivada ? "0" : "1"} />
        <Boton type="submit" variante="secundario" className="w-full">
          {c.archivada ? "Reactivar" : "Archivar"}
        </Boton>
      </FormularioAccion>
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
        clase === valor ? "bg-elevada text-tinta shadow-[0_0_0_1px_var(--color-borde)]" : "text-tenue"
      }`}
    >
      {texto}
    </Link>
  );

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 rounded-xl bg-mosaico p-1">
        {pestana("gasto", "Gastos")}
        {pestana("ingreso", "Ingresos")}
      </nav>

      <Tarjeta>
        <ul className="divide-y divide-divisor">
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
                <ul className="mt-1 ml-4 border-l border-borde pl-3">
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
                  <summary className="cursor-pointer text-xs font-semibold text-tinta">+ Subcategoría</summary>
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
