import type { Metadata } from "next";
import { AreaTexto, Aviso, Campo, Chip, Selector, Tarjeta, Titulo } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import { mensajeError } from "@/lib/acciones";
import { obtenerStaff } from "@/lib/consola/sesion";
import type { Mapeo } from "@/lib/importacion";
import { TarjetaTabla } from "../tarjeta-tabla";
import { FormularioEstado } from "@/components/ui/formulario-estado";
import { guardarCategoriaBase, guardarFormato, guardarReglaGlobal, importarReglas } from "./acciones";

export const metadata: Metadata = { title: "Catálogos" };

type Categoria = {
  id: string;
  nombre: string;
  padre_id: string | null;
  clase: "gasto" | "ingreso";
  tipo: "fijo" | "variable";
  es_esencial: boolean;
  excluir_de_costo_vida: boolean;
  etiqueta_dian: string | null;
  orden: number;
  activa: boolean;
  hogares: number;
};
type Regla = { id: string; patron: string; categoria: string; ambito: string | null; origen: string; activa: boolean };
type Datos = {
  categorias: Categoria[];
  reglas: Regla[];
  sugeridas: { patron: string; categoria: string; hogares: number; ambigua: boolean }[];
  formatos: { id: string; banco: string; encabezados: string[]; mapeo: Mapeo; activo: boolean }[];
  etiquetas: { codigo: string; nombre: string }[];
};

const control = "h-9 min-w-0 rounded-lg border border-control bg-elevada px-2 text-sm disabled:border-transparent disabled:bg-transparent";

/** Fila editable de una categoría base (o la vacía para crear). */
function FilaCategoria({ c, raices, etiquetas, puede }: { c?: Categoria; raices: Categoria[]; etiquetas: Datos["etiquetas"]; puede: boolean }) {
  return (
    <FormularioAccion accion={guardarCategoriaBase} className="grid grid-cols-2 items-center gap-2 py-2 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_96px_104px_minmax(0,1.2fr)_56px_auto]">
      {c && <input type="hidden" name="id" value={c.id} />}
      <input name="nombre" defaultValue={c?.nombre} placeholder="Nueva categoría" aria-label="Nombre" disabled={!puede} className={control} required />
      <select name="padre" defaultValue={c?.padre_id ?? ""} aria-label="Categoría madre" disabled={!puede} className={control}>
        <option value="">Principal</option>
        {raices
          .filter((r) => r.id !== c?.id)
          .map((r) => (
            <option key={r.id} value={r.id}>
              Dentro de {r.nombre}
            </option>
          ))}
      </select>
      <select name="clase" defaultValue={c?.clase ?? "gasto"} aria-label="Clase" disabled={!puede} className={control}>
        <option value="gasto">Gasto</option>
        <option value="ingreso">Ingreso</option>
      </select>
      <select name="tipo" defaultValue={c?.tipo ?? "variable"} aria-label="Tipo" disabled={!puede} className={control}>
        <option value="fijo">Fijo</option>
        <option value="variable">Variable</option>
      </select>
      <select name="etiqueta" defaultValue={c?.etiqueta_dian ?? ""} aria-label="Etiqueta DIAN" disabled={!puede} className={control}>
        <option value="">Sin etiqueta DIAN</option>
        {etiquetas.map((e) => (
          <option key={e.codigo} value={e.codigo}>
            {e.nombre}
          </option>
        ))}
      </select>
      <input name="orden" type="number" min={0} max={999} defaultValue={c?.orden ?? 100} aria-label="Orden" disabled={!puede} className={control} />
      <span className="col-span-2 flex flex-wrap items-center gap-3 text-[13px] md:col-span-1">
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" name="esencial" defaultChecked={c?.es_esencial} disabled={!puede} className="size-4 accent-monte" />
          Esencial
        </label>
        <label className="inline-flex items-center gap-1.5" title="No suma al costo de vida (ahorro, inversión)">
          <input type="checkbox" name="excluir" defaultChecked={c?.excluir_de_costo_vida} disabled={!puede} className="size-4 accent-monte" />
          Fuera del costo
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" name="activa" defaultChecked={c?.activa ?? true} disabled={!puede} className="size-4 accent-monte" />
          Activa
        </label>
        {c && <span className="text-tenue">{c.hogares.toLocaleString("es-CO")} hogares</span>}
        {puede && (
          <BotonEnviar variante={c ? "fantasma" : "secundario"} className="h-8 px-3 text-sm" pendiente="…">
            {c ? "Guardar" : "Crear"}
          </BotonEnviar>
        )}
      </span>
    </FormularioAccion>
  );
}

export default async function Catalogos() {
  const staff = await obtenerStaff();
  const { data, error } = await staff.supabase.rpc("consola_catalogos");
  const d = (data ?? { categorias: [], reglas: [], sugeridas: [], formatos: [], etiquetas: [] }) as unknown as Datos;
  const puede = staff.puede("parametros");
  const raices = d.categorias.filter((c) => !c.padre_id);
  // Principales y, debajo de cada una, sus subcategorías.
  const ordenadas = raices.flatMap((r) => [r, ...d.categorias.filter((c) => c.padre_id === r.id)]);
  const nombres = [...new Set(d.categorias.filter((c) => c.activa).map((c) => c.nombre))].sort((a, b) => a.localeCompare(b, "es"));

  return (
    <>
      <Titulo registrar={false} subtitulo="Categorías con que nace cada hogar, reglas de comercio para todas las familias y formatos de extracto por banco">
        Catálogos
      </Titulo>
      {error && <Aviso>{mensajeError(error)}</Aviso>}

      <div className="flex flex-col gap-5">
        <TarjetaTabla titulo="Categorías por defecto" subtitulo="Los hogares nuevos nacen con las activas; los existentes no cambian (cada hogar edita las suyas)">
          <div className="flex flex-col divide-y divide-divisor px-4 md:px-6">
            {ordenadas.map((c) => (
              <div key={c.id} className={c.padre_id ? "md:pl-6" : undefined}>
                <FilaCategoria c={c} raices={raices} etiquetas={d.etiquetas} puede={puede} />
              </div>
            ))}
            {puede && <FilaCategoria raices={raices} etiquetas={d.etiquetas} puede={puede} />}
          </div>
        </TarjetaTabla>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
          <TarjetaTabla titulo="Reglas de comercio globales" subtitulo="Se aplican antes que la IA y antes de preguntar; las reglas que aprende cada hogar tienen prioridad">
            {d.reglas.length === 0 ? (
              <p className="px-4 pb-3 text-sm text-tenue md:px-6">Aún no hay reglas globales.</p>
            ) : (
              <table className="tabla">
                <thead>
                  <tr>
                    <th className="pl-4! md:pl-6!">Patrón</th>
                    <th>Categoría</th>
                    <th>Origen</th>
                    <th className="pr-4! md:pr-6!">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {d.reglas.map((r) => (
                    <tr key={r.id}>
                      <td className="pl-4! font-mono text-[13px] md:pl-6!">{r.patron}</td>
                      <td>
                        {r.categoria}
                        {r.ambito === "negocio" && <span className="text-tenue"> · negocio</span>}
                      </td>
                      <td>
                        <Chip plano>{r.origen === "aprendida" ? "Aprendida" : "Manual"}</Chip>
                      </td>
                      <td className="pr-4! md:pr-6!">
                        {puede ? (
                          <FormularioAccion accion={guardarReglaGlobal} className="inline-flex">
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="patron" value={r.patron} />
                            <input type="hidden" name="categoria" value={r.categoria} />
                            <input type="hidden" name="ambito" value={r.ambito ?? ""} />
                            <input type="hidden" name="activa" value={r.activa ? "0" : "1"} />
                            <BotonEnviar variante="fantasma" className="h-8 px-2 text-sm" pendiente="…">
                              {r.activa ? "Activa · desactivar" : "Inactiva · activar"}
                            </BotonEnviar>
                          </FormularioAccion>
                        ) : (
                          <Chip tono={r.activa ? "ok" : "neutro"}>{r.activa ? "Activa" : "Inactiva"}</Chip>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TarjetaTabla>

          <div className="flex min-w-0 flex-col gap-5">
            {puede && (
              <Tarjeta titulo="Nueva regla">
                <FormularioEstado accion={guardarReglaGlobal} className="flex flex-col gap-3">
                  <Campo etiqueta="Patrón del comercio" name="patron" placeholder="rappi" required maxLength={80} ayuda="Palabras que aparecen en el comercio o la descripción del banco." />
                  <Selector etiqueta="Categoría" name="categoria" required defaultValue="">
                    <option value="" disabled>
                      Elige una
                    </option>
                    {nombres.map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </Selector>
                  <Selector etiqueta="Ámbito" name="ambito" defaultValue="">
                    <option value="">Lo que diga la lectura</option>
                    <option value="personal">Personal</option>
                    <option value="negocio">Negocio</option>
                  </Selector>
                  <BotonEnviar variante="secundario" pendiente="Guardando…" className="self-start">
                    Agregar regla
                  </BotonEnviar>
                </FormularioEstado>
              </Tarjeta>
            )}
            {puede && (
              <Tarjeta titulo="Importar reglas" subtitulo="Una por línea: «patrón; categoría» (también sirve copiar dos columnas de una hoja de cálculo)">
                <FormularioEstado accion={importarReglas} className="flex flex-col gap-3">
                  <AreaTexto etiqueta="Reglas" name="reglas" rows={5} placeholder={"terpel; Transporte\nexito; Mercado"} />
                  <BotonEnviar variante="secundario" pendiente="Importando…" className="self-start">
                    Importar
                  </BotonEnviar>
                </FormularioEstado>
              </Tarjeta>
            )}
          </div>
        </div>

        <TarjetaTabla titulo="Aprendidas por los hogares" subtitulo="Patrones que 3 o más hogares ya mandan a la misma categoría; «ambigua» si otros los mandan a otra">
          {d.sugeridas.length === 0 ? (
            <p className="px-4 pb-3 text-sm text-tenue md:px-6">Todavía ningún patrón se repite en 3 hogares.</p>
          ) : (
            <table className="tabla">
              <thead>
                <tr>
                  <th className="pl-4! md:pl-6!">Patrón</th>
                  <th>Categoría</th>
                  <th className="der">Hogares</th>
                  <th className="pr-4! md:pr-6!">
                    <span className="sr-only">Agregar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.sugeridas.map((s) => (
                  <tr key={`${s.patron}|${s.categoria}`}>
                    <td className="pl-4! font-mono text-[13px] md:pl-6!">{s.patron}</td>
                    <td>
                      {s.categoria} {s.ambigua && <Chip tono="alerta">Ambigua</Chip>}
                    </td>
                    <td className="der">{s.hogares}</td>
                    <td className="pr-4! md:pr-6!">
                      {puede && (
                        <FormularioAccion accion={guardarReglaGlobal} className="inline-flex">
                          <input type="hidden" name="patron" value={s.patron} />
                          <input type="hidden" name="categoria" value={s.categoria} />
                          <input type="hidden" name="origen" value="aprendida" />
                          <BotonEnviar variante="fantasma" className="h-8 px-2 text-sm" pendiente="…">
                            Hacer global
                          </BotonEnviar>
                        </FormularioAccion>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TarjetaTabla>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
          <TarjetaTabla titulo="Formatos de extracto" subtitulo="El importador reconoce el banco por sus encabezados y llena el mapeo solo">
            {d.formatos.length === 0 ? (
              <p className="px-4 pb-3 text-sm text-tenue md:px-6">Sin formatos: el importador adivina las columnas por su nombre.</p>
            ) : (
              <table className="tabla">
                <thead>
                  <tr>
                    <th className="pl-4! md:pl-6!">Banco</th>
                    <th>Encabezados</th>
                    <th>Columnas</th>
                    <th className="pr-4! md:pr-6!">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {d.formatos.map((f) => (
                    <tr key={f.id}>
                      <td className="pl-4! font-semibold md:pl-6!">{f.banco}</td>
                      <td className="max-w-72 truncate text-[13px] text-cuerpo" title={f.encabezados.join(", ")}>
                        {f.encabezados.join(", ")}
                      </td>
                      <td className="text-[13px] text-cuerpo">
                        {f.mapeo.fecha} · {f.mapeo.descripcion} · {f.mapeo.modo === "unico" ? f.mapeo.monto : `${f.mapeo.debito} / ${f.mapeo.credito}`}
                      </td>
                      <td className="pr-4! md:pr-6!">
                        {puede ? (
                          <FormularioAccion accion={guardarFormato} className="inline-flex">
                            <input type="hidden" name="id" value={f.id} />
                            <input type="hidden" name="banco" value={f.banco} />
                            <input type="hidden" name="encabezados" value={f.encabezados.join(";")} />
                            <input type="hidden" name="fecha" value={f.mapeo.fecha} />
                            <input type="hidden" name="descripcion" value={f.mapeo.descripcion} />
                            <input type="hidden" name="modo" value={f.mapeo.modo} />
                            <input type="hidden" name="monto" value={f.mapeo.monto ?? ""} />
                            <input type="hidden" name="debito" value={f.mapeo.debito ?? ""} />
                            <input type="hidden" name="credito" value={f.mapeo.credito ?? ""} />
                            {f.mapeo.gastosNegativos && <input type="hidden" name="gastosNegativos" value="on" />}
                            <input type="hidden" name="activo_presente" value="1" />
                            {!f.activo && <input type="hidden" name="activo" value="on" />}
                            <BotonEnviar variante="fantasma" className="h-8 px-2 text-sm" pendiente="…">
                              {f.activo ? "Activo · desactivar" : "Inactivo · activar"}
                            </BotonEnviar>
                          </FormularioAccion>
                        ) : (
                          <Chip tono={f.activo ? "ok" : "neutro"}>{f.activo ? "Activo" : "Inactivo"}</Chip>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TarjetaTabla>

          {puede && (
            <Tarjeta titulo="Nuevo formato" subtitulo="Copia la fila de encabezados del CSV del banco y di qué columna es cada cosa">
              <FormularioEstado accion={guardarFormato} className="flex flex-col gap-3">
                <Campo etiqueta="Banco o formato" name="banco" placeholder="Bancolombia · cuenta de ahorros" required maxLength={60} />
                <Campo etiqueta="Encabezados" name="encabezados" placeholder="FECHA;DESCRIPCIÓN;SUCURSAL;REFERENCIA;VALOR" required />
                <div className="grid grid-cols-2 gap-3">
                  <Campo etiqueta="Columna de fecha" name="fecha" placeholder="FECHA" required />
                  <Campo etiqueta="Columna de descripción" name="descripcion" placeholder="DESCRIPCIÓN" required />
                </div>
                <Selector etiqueta="Valores" name="modo" defaultValue="unico">
                  <option value="unico">Una columna con signo</option>
                  <option value="separado">Columnas de débito y crédito</option>
                </Selector>
                <div className="grid grid-cols-3 gap-3">
                  <Campo etiqueta="Valor" name="monto" placeholder="VALOR" />
                  <Campo etiqueta="Débito" name="debito" placeholder="—" />
                  <Campo etiqueta="Crédito" name="credito" placeholder="—" />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="gastosNegativos" defaultChecked className="size-4 accent-monte" />
                  Los gastos vienen en negativo
                </label>
                <BotonEnviar variante="secundario" pendiente="Guardando…" className="self-start">
                  Guardar formato
                </BotonEnviar>
              </FormularioEstado>
            </Tarjeta>
          )}
        </div>
      </div>
    </>
  );
}
