"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Aviso, claseControl } from "@/components/ui";
import { Icono } from "@/components/marca";
import { iconoCategoria } from "@/lib/categorias/iconos";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { CampoMonto } from "@/components/ui/campo-monto";
import { opcionesCategoria, type Categoria } from "@/lib/categorias";
import type { CuentaOpcion } from "@/lib/catalogos";
import type { Estado } from "@/lib/acciones";
import { registrarRapido } from "../movimientos/acciones";
import { camposDe, encolar, esErrorDeRed, nuevaClave } from "@/lib/cola";
import { EVENTO_COLA } from "@/components/cola-sin-conexion";
import { SelectorTipo } from "../movimientos/formulario";

const CLAVE_CUENTA = "myhouse:ultima-cuenta";

type Props = {
  cuentas: CuentaOpcion[];
  categorias: Categoria[];
  /** ids de categoría ordenados por uso reciente (más usadas primero). */
  frecuentes: string[];
  hoy: string;
};

const chip = (activo: boolean, conIcono = false) =>
  `inline-flex h-10 items-center gap-2 rounded-full border pr-3.5 ${conIcono ? "pl-1.5" : "pl-3.5"} text-sm font-semibold transition ${
    activo ? "border-monte bg-monte text-arena" : "border-control bg-elevada text-tinta hover:bg-mosaico"
  }`;

export function RegistroRapido({ cuentas, categorias, frecuentes, hoy }: Props) {
  const [tipo, setTipo] = useState<"gasto" | "ingreso">("gasto");
  const [cuenta, setCuenta] = useState(cuentas[0]?.id ?? "");
  const [categoria, setCategoria] = useState("");
  const [reinicio, setReinicio] = useState(0);

  // Última cuenta usada en este dispositivo.
  useEffect(() => {
    const guardada = localStorage.getItem(CLAVE_CUENTA);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage solo existe en el cliente
    if (guardada && cuentas.some((c) => c.id === guardada)) setCuenta(guardada);
  }, [cuentas]);

  const [estado, accion] = useActionState(async (previo: Estado, datos: FormData): Promise<Estado> => {
    // Una clave por registro, antes de decidir si va a la cola: el reenvío desde la cola usa la misma y no duplica.
    datos.set("clave", nuevaClave());
    // Sin señal (o si se cae a mitad del envío) el registro queda en este celular y se envía al volver.
    const enCola = (): Estado => {
      if (!encolar(localStorage, camposDe(datos))) return { error: "Hay demasiados registros esperando conexión. Conéctate para enviarlos." };
      window.dispatchEvent(new Event(EVENTO_COLA));
      return { ok: "Sin conexión: lo guardé en este celular y lo envío apenas vuelva la señal." };
    };
    let r: Estado;
    if (!navigator.onLine) r = enCola();
    else {
      try {
        r = await registrarRapido(previo, datos);
      } catch (e) {
        if (!esErrorDeRed(e)) throw e;
        r = enCola();
      }
    }
    if (r?.ok) {
      localStorage.setItem(CLAVE_CUENTA, cuenta);
      setCategoria("");
      setReinicio((n) => n + 1);
      navigator.vibrate?.(30);
    }
    return r;
  }, null);

  const opciones = opcionesCategoria(categorias, tipo);
  const porId = new Map(opciones.map((o) => [o.id, o]));
  // Primero las más usadas; para completar, las raíces más probables en el día a día:
  // variables esenciales, luego el resto, y al final lo que no es costo de vida.
  const peso = (c: Categoria) => (c.excluir_de_costo_vida ? 4 : 0) + (c.es_esencial ? 0 : 2) + (c.tipo === "variable" ? 0 : 1);
  const relleno = categorias
    .filter((c) => c.clase === tipo && !c.padre_id && !c.archivada && !frecuentes.includes(c.id))
    .sort((a, b) => peso(a) - peso(b) || a.nombre.localeCompare(b.nombre, "es"))
    .map((c) => c.id);
  const chips = [...frecuentes.filter((id) => porId.has(id)), ...relleno].slice(0, 8);
  const otraSeleccionada = categoria && !chips.includes(categoria);

  return (
    <form action={accion} className="flex flex-col gap-5">
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="fecha" value={hoy} />
      <input type="hidden" name="account_id" value={cuenta} />
      <input type="hidden" name="category_id" value={categoria} />

      <SelectorTipo
        tipo={tipo}
        incluirTransferencia={false}
        onCambio={(t) => {
          setTipo(t as "gasto" | "ingreso");
          setCategoria("");
        }}
      />

      <CampoMonto key={reinicio} etiqueta="¿Cuánto?" name="monto" grande autoFocus enterKeyHint="done" />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[13px] leading-[18px] font-semibold text-cuerpo">¿En qué?</legend>
        <div className="flex flex-wrap gap-2">
          {chips.map((id) => (
            <button key={id} type="button" className={chip(categoria === id, true)} onClick={() => setCategoria(id)} aria-pressed={categoria === id}>
              <span className={`inline-flex size-7 items-center justify-center rounded-full ${categoria === id ? "bg-arena/15" : "bg-mosaico"}`}>
                <Icono nombre={iconoCategoria(porId.get(id)?.etiqueta, tipo)} tamano={16} acento={categoria !== id} />
              </span>
              {porId.get(id)?.etiqueta}
            </button>
          ))}
        </div>
        <select
          aria-label="Otra categoría"
          value={otraSeleccionada ? categoria : ""}
          onChange={(e) => setCategoria(e.target.value)}
          className={`${claseControl} ${otraSeleccionada ? "border-monte" : ""}`}
        >
          <option value="">Otra categoría…</option>
          {opciones.map((o) => (
            <option key={o.id} value={o.id}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[13px] leading-[18px] font-semibold text-cuerpo">¿De dónde?</legend>
        <div className="flex flex-wrap gap-2">
          {cuentas.map((c) => (
            <button key={c.id} type="button" className={chip(cuenta === c.id)} onClick={() => setCuenta(c.id)} aria-pressed={cuenta === c.id}>
              {c.nombre}
            </button>
          ))}
        </div>
      </fieldset>

      {estado?.error && <Aviso>{estado.error}</Aviso>}
      {estado?.ok && (
        <Aviso tipo="ok">
          {estado.ok}{" "}
          <Link href="/movimientos" className="font-semibold underline">
            Ver movimientos
          </Link>
        </Aviso>
      )}

      <BotonEnviar className="h-12 w-full text-base" disabled={!categoria || !cuenta}>
        Guardar {tipo}
      </BotonEnviar>
    </form>
  );
}
