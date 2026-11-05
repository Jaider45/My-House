"use client";

import Papa from "papaparse";
import { useMemo, useState, useTransition } from "react";
import { Aviso, Boton, Campo, Selector, Tarjeta } from "@/components/ui";
import { formatearCOP } from "@/lib/dinero";
import { formatearFecha } from "@/lib/fechas";
import { opcionesCategoria, type Categoria } from "@/lib/categorias";
import { detectarEncabezado, leerFilas, sugerirMapeo, type Clasificacion, type Mapeo } from "@/lib/importacion";
import { analizarImportacion, importarMovimientos, leerExtractoPdf } from "./acciones";

type Cuenta = { id: string; nombre: string; mapeo_csv: Mapeo | null };
type Archivo = { nombre: string; columnas: string[]; filas: Record<string, string>[] };
type Revision = { estado: Clasificacion; incluir: boolean; category_id: string | null };

const ETIQUETA: Record<Clasificacion, { texto: string; clase: string }> = {
  nuevo: { texto: "Nuevo", clase: "bg-ok-fondo text-ok-tinta" },
  duplicado: { texto: "Ya importado", clase: "bg-pista text-cuerpo" },
  posible: { texto: "¿Duplicado?", clase: "bg-alerta-fondo text-alerta-tinta" },
};

/** Lee el CSV como UTF-8; si aparecen caracteres dañados, lo relee como Windows-1252 (común en bancos). */
async function leerTexto(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(buffer) : utf8;
}

function celdas(texto: string): string[][] {
  return Papa.parse<string[]>(texto.replace(/^﻿/, ""), { skipEmptyLines: "greedy" }).data;
}

function aObjetos(texto: string, saltar: number): Omit<Archivo, "nombre"> {
  const [encabezado = [], ...resto] = celdas(texto).slice(saltar);
  const columnas = encabezado.map((c, i) => c.trim() || `Columna ${i + 1}`);
  return {
    columnas,
    filas: resto.map((celdas) => Object.fromEntries(columnas.map((c, i) => [c, celdas[i] ?? ""]))),
  };
}

export function Importador({ cuentas, categorias }: { cuentas: Cuenta[]; categorias: Categoria[] }) {
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id ?? "");
  const [texto, setTexto] = useState<{ nombre: string; contenido: string }>();
  const [saltar, setSaltar] = useState(0);
  const [mapeo, setMapeo] = useState<Mapeo>();
  const [revision, setRevision] = useState<Revision[]>();
  const [mensaje, setMensaje] = useState<{ tipo: "error" | "ok"; texto: string }>();
  const [pendiente, iniciar] = useTransition();

  const archivo = useMemo<Archivo | undefined>(() => (texto ? { nombre: texto.nombre, ...aObjetos(texto.contenido, saltar) } : undefined), [texto, saltar]);
  const lectura = useMemo(() => (archivo && mapeo ? leerFilas(archivo.filas, mapeo) : undefined), [archivo, mapeo]);
  const cuenta = cuentas.find((c) => c.id === cuentaId);

  function reiniciarRevision() {
    setRevision(undefined);
    setMensaje(undefined);
  }

  /** Usa el mapeo guardado de la cuenta si calza con las columnas; si no, lo adivina. */
  function mapeoPara(columnas: string[]): Mapeo {
    const guardado = cuenta?.mapeo_csv;
    return guardado && columnas.includes(guardado.fecha) ? guardado : sugerirMapeo(columnas);
  }

  /** PDF: el servidor extrae las filas y se arma un CSV equivalente (Fecha, Descripción, Valor con signo). */
  function leerPdf(file: File) {
    iniciar(async () => {
      const datos = new FormData();
      datos.append("archivo", file);
      const r = await leerExtractoPdf(datos);
      if (r.error || !r.filas) return setMensaje({ tipo: "error", texto: r.error ?? "No pude leer el PDF." });
      const contenido = Papa.unparse({ fields: ["Fecha", "Descripción", "Valor"], data: r.filas.map((f) => [f.fecha, f.descripcion, String(f.valor)]) });
      setTexto({ nombre: file.name, contenido });
      setSaltar(0);
      setMapeo({ ...sugerirMapeo(["Fecha", "Descripción", "Valor"]), gastosNegativos: true });
      setMensaje({ tipo: "ok", texto: `Leí ${r.filas.length} movimientos${r.banco ? ` del extracto de ${r.banco}` : ""}. Revísalos y analiza los duplicados.` });
    });
  }

  async function elegirArchivo(file: File | undefined) {
    reiniciarRevision();
    if (!file) return setTexto(undefined);
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return leerPdf(file);
    const contenido = await leerTexto(file);
    const fila = detectarEncabezado(celdas(contenido));
    setTexto({ nombre: file.name, contenido });
    setSaltar(fila);
    setMapeo(mapeoPara(aObjetos(contenido, fila).columnas));
  }

  function cambiarSaltar(n: number) {
    reiniciarRevision();
    setSaltar(n);
    if (texto) setMapeo(mapeoPara(aObjetos(texto.contenido, n).columnas));
  }

  const cambiarMapeo = (cambios: Partial<Mapeo>) => {
    reiniciarRevision();
    setMapeo((m) => (m ? { ...m, ...cambios } : m));
  };

  function analizar() {
    if (!lectura?.validas.length) return;
    iniciar(async () => {
      const r = await analizarImportacion({ cuentaId, filas: lectura.validas });
      if (r.error || !r.estados) return setMensaje({ tipo: "error", texto: r.error ?? "No se pudo analizar." });
      setRevision(r.estados.map((estado, i) => ({ estado, incluir: estado === "nuevo", category_id: r.sugerencias?.[i] ?? null })));
    });
  }

  function importar() {
    if (!lectura || !revision || !mapeo || !archivo) return;
    iniciar(async () => {
      const r = await importarMovimientos({
        cuentaId,
        archivo: archivo.nombre,
        mapeo,
        filas: lectura.validas.map((f, i) => ({ ...f, incluir: revision[i].incluir, category_id: revision[i].category_id })),
      });
      if (r.error) return setMensaje({ tipo: "error", texto: r.error });
      setMensaje({ tipo: "ok", texto: `Importados ${r.importadas} movimientos. ${r.duplicadas} filas no se importaron.` });
      setRevision(undefined);
      setTexto(undefined);
    });
  }

  const columnas = archivo?.columnas ?? [];
  const selectorColumna = (etiqueta: string, campo: keyof Mapeo, opcional = false) => (
    <Selector etiqueta={etiqueta} value={(mapeo?.[campo] as string) ?? ""} onChange={(e) => cambiarMapeo({ [campo]: e.target.value })}>
      {opcional && <option value="">(ninguna)</option>}
      {!opcional && <option value="">Elige…</option>}
      {columnas.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </Selector>
  );

  const resumen = revision && {
    incluidas: revision.filter((r) => r.incluir).length,
    duplicadas: revision.filter((r) => r.estado === "duplicado").length,
    posibles: revision.filter((r) => r.estado === "posible").length,
  };
  const actualizar = (i: number, cambio: Partial<Revision>) => setRevision((rs) => rs?.map((r, j) => (j === i ? { ...r, ...cambio } : r)));

  return (
    <div className="space-y-4">
      {mensaje && <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>}

      <Tarjeta titulo="1. Archivo">
        <div className="space-y-3">
          <Selector etiqueta="Cuenta del extracto" value={cuentaId} onChange={(e) => { setCuentaId(e.target.value); reiniciarRevision(); }}>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Selector>
          <label className="block space-y-1">
            <span className="text-[13px] font-semibold text-cuerpo">Extracto en PDF o CSV</span>
            <input
              type="file"
              accept=".pdf,application/pdf,.csv,text/csv"
              onChange={(e) => elegirArchivo(e.target.files?.[0])}
              className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-monte file:px-4 file:font-semibold file:text-arena"
            />
            <span className="block text-[13px] text-tenue">
              {pendiente && !archivo ? "Leyendo el PDF… puede tardar unos segundos por página." : "El PDF lo leo con IA; el CSV se lee aquí mismo, sin salir del celular."}
            </span>
          </label>
          {archivo && (
            <Campo
              etiqueta="Filas antes del encabezado"
              type="number"
              min={0}
              max={50}
              value={saltar}
              onChange={(e) => cambiarSaltar(Number(e.target.value) || 0)}
              ayuda={`Encabezado detectado: ${columnas.join(" · ") || "—"}`}
            />
          )}
        </div>
      </Tarjeta>

      {archivo && mapeo && (
        <Tarjeta titulo="2. Columnas">
          <div className="space-y-3">
            {selectorColumna("Fecha", "fecha")}
            {selectorColumna("Descripción", "descripcion")}
            <Selector etiqueta="¿Cómo viene el valor?" value={mapeo.modo} onChange={(e) => cambiarMapeo({ modo: e.target.value as Mapeo["modo"] })}>
              <option value="unico">Una columna con el valor</option>
              <option value="separado">Columnas separadas de débito y crédito</option>
            </Selector>
            {mapeo.modo === "unico" ? (
              <>
                {selectorColumna("Valor", "monto")}
                <Selector
                  etiqueta="Los gastos vienen…"
                  value={mapeo.gastosNegativos ? "neg" : "pos"}
                  onChange={(e) => cambiarMapeo({ gastosNegativos: e.target.value === "neg" })}
                >
                  <option value="neg">En negativo (−50.000)</option>
                  <option value="pos">En positivo (típico de tarjetas de crédito)</option>
                </Selector>
              </>
            ) : (
              <>
                {selectorColumna("Débito (salidas)", "debito")}
                {selectorColumna("Crédito (entradas)", "credito")}
              </>
            )}
            {lectura && (
              <p className="text-sm text-tenue">
                {lectura.validas.length} filas leídas
                {lectura.errores.length > 0 && `, ${lectura.errores.length} con problemas (fila ${lectura.errores.slice(0, 5).map((e) => e.fila).join(", ")}${lectura.errores.length > 5 ? "…" : ""}: ${lectura.errores[0].motivo})`}
                .
              </p>
            )}
            <Boton type="button" onClick={analizar} disabled={pendiente || !lectura?.validas.length} className="w-full">
              {pendiente && !revision ? "Revisando…" : "Revisar movimientos"}
            </Boton>
          </div>
        </Tarjeta>
      )}

      {revision && lectura && resumen && (
        <Tarjeta titulo="3. Revisar e importar">
          <p className="mb-3 text-sm">
            <strong>{resumen.incluidas}</strong> por importar · {resumen.duplicadas} ya importados · {resumen.posibles} posibles duplicados
            (desmarcados: parecen registros manuales; márquelos si son distintos).
          </p>
          <ul className="max-h-[60vh] divide-y divide-divisor overflow-y-auto">
            {lectura.validas.map((f, i) => {
              const r = revision[i];
              return (
                <li key={f.fila} className={`space-y-1 py-2 ${r.incluir ? "" : "opacity-60"}`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-5 accent-monte"
                      checked={r.incluir}
                      disabled={r.estado === "duplicado"}
                      onChange={(e) => actualizar(i, { incluir: e.target.checked })}
                      aria-label={`Importar fila ${f.fila}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{f.descripcion || "(sin descripción)"}</span>
                      <span className="text-xs text-tenue">{formatearFecha(f.fecha)}</span>
                    </span>
                    <span className={`text-sm font-semibold tabular-nums ${f.tipo === "ingreso" ? "text-ok-tinta" : "text-error-tinta"}`}>
                      {f.tipo === "ingreso" ? "+" : "−"}
                      {formatearCOP(f.monto)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pl-7">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${ETIQUETA[r.estado].clase}`}>{ETIQUETA[r.estado].texto}</span>
                    {r.estado !== "duplicado" && (
                      <select
                        value={r.category_id ?? ""}
                        onChange={(e) => actualizar(i, { category_id: e.target.value || null })}
                        className="min-h-8 min-w-0 flex-1 rounded-lg border border-control bg-transparent px-2 text-xs"
                        aria-label="Categoría"
                      >
                        <option value="">Sin categoría</option>
                        {opcionesCategoria(categorias, f.tipo).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.etiqueta}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <Boton type="button" onClick={importar} disabled={pendiente || !resumen.incluidas} className="mt-3 w-full">
            {pendiente ? "Importando…" : `Importar ${resumen.incluidas} movimientos`}
          </Boton>
        </Tarjeta>
      )}
    </div>
  );
}
