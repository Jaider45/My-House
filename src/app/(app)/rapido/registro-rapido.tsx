"use client";

import { formatearCOP } from "@/lib/dinero";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { Aviso, claseControl, cx } from "@/components/ui";
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
import { buscarSugerencia, normalizar, type Sugerencia } from "@/lib/registro/sugerencias";
import { esCategoriaDeudas } from "@/lib/deudas";
import { CampoDeuda, type OpcionDeuda } from "@/components/ui/campo-deuda";

export type { Sugerencia };

const CLAVE_CUENTA = "myhouse:ultima-cuenta";

type Props = {
  cuentas: CuentaOpcion[];
  categorias: Categoria[];
  /** Deudas activas: si la categoría es Deudas se pregunta cuál se paga. */
  deudas?: OpcionDeuda[];
  /** ids de categoría ordenados por uso reciente (más usadas primero). */
  frecuentes: string[];
  /** Conceptos recientes (el más reciente primero), sin repetir. */
  sugerencias: Sugerencia[];
  hoy: string;
  /** Cierra la ventana tras «Guardar» (con «Guardar y otro» se queda). */
  alGuardar?: () => void;
  /** Rol Familiar: solo registra gastos (sin selector de tipo). */
  soloGasto?: boolean;
  /** TRM del hogar para pagos en dólares (null = no hay). */
  trm?: number | null;
};

const chip = (activo: boolean, conIcono = false) =>
  `inline-flex h-10 items-center gap-2 rounded-full border pr-3.5 ${conIcono ? "pl-1.5" : "pl-3.5"} text-sm font-semibold transition ${
    activo ? "border-monte bg-monte text-arena" : "border-control bg-elevada text-tinta hover:bg-mosaico"
  }`;

const seg = (activo: boolean) =>
  cx("h-9 rounded-lg px-3.5 text-sm font-semibold", activo ? "bg-elevada text-tinta shadow-[0_0_0_1px_var(--color-borde)]" : "text-cuerpo");

/**
 * Registrar → «Escribirlo» (diseño «Registrar movimiento»): monto grande, concepto en texto libre y la categoría y la
 * cuenta que sugiere lo último registrado con ese concepto. «Cambiar» abre las categorías más usadas y las cuentas.
 */
export function RegistroRapido({ cuentas, categorias, deudas = [], frecuentes, sugerencias, hoy, alGuardar, soloGasto, trm }: Props) {
  const [enDolares, setEnDolares] = useState(false);
  const [dolares, setDolares] = useState("");
  const [tipo, setTipo] = useState<"gasto" | "ingreso">("gasto");
  const [cuenta, setCuenta] = useState(cuentas[0]?.id ?? "");
  const [concepto, setConcepto] = useState("");
  const [elegida, setElegida] = useState(""); // categoría elegida a mano (manda sobre la sugerida)
  const [cambiar, setCambiar] = useState(false);
  const [pagado, setPagado] = useState(true);
  const [reinicio, setReinicio] = useState(0);
  const [monto, setMonto] = useState(0);
  const [montoInicial, setMontoInicial] = useState(0);
  const [deuda, setDeuda] = useState("");

  // Última cuenta usada en este dispositivo.
  useEffect(() => {
    const guardada = localStorage.getItem(CLAVE_CUENTA);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage solo existe en el cliente
    if (guardada && cuentas.some((c) => c.id === guardada)) setCuenta(guardada);
  }, [cuentas]);

  const sugerida = useMemo(() => buscarSugerencia(concepto, tipo, sugerencias), [concepto, tipo, sugerencias]);
  const categoria = elegida || sugerida?.category_id || "";

  const [estado, accion] = useActionState(async (previo: Estado, datos: FormData): Promise<Estado> => {
    const seguir = datos.get("seguir") === "1";
    datos.delete("seguir");
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
      setConcepto("");
      setElegida("");
      setCambiar(false);
      setDeuda("");
      setMonto(0);
      setMontoInicial(0);
      setReinicio((n) => n + 1);
      navigator.vibrate?.(30);
      if (!seguir) alGuardar?.();
    }
    return r;
  }, null);

  const opciones = opcionesCategoria(categorias, tipo);
  const porId = new Map(opciones.map((o) => [o.id, o]));
  // Primero las más usadas; para completar, las raíces más probables en el día a día.
  const peso = (c: Categoria) => (c.excluir_de_costo_vida ? 4 : 0) + (c.es_esencial ? 0 : 2) + (c.tipo === "variable" ? 0 : 1);
  const relleno = categorias
    .filter((c) => c.clase === tipo && !c.padre_id && !c.archivada && !frecuentes.includes(c.id))
    .sort((a, b) => peso(a) - peso(b) || a.nombre.localeCompare(b.nombre, "es"))
    .map((c) => c.id);
  const chips = [...frecuentes.filter((id) => porId.has(id)), ...relleno].slice(0, 8);
  const otraSeleccionada = categoria && !chips.includes(categoria);
  const recientes = sugerencias.filter((s) => s.tipo === tipo).slice(0, 3);
  const nombreCuenta = cuentas.find((c) => c.id === cuenta)?.nombre;
  // Las categorías se abren con «Cambiar» o si el concepto no se parece a nada registrado antes.
  const abierto = cambiar || (!categoria && normalizar(concepto).length >= 3);
  const conDeuda = tipo === "gasto" && esCategoriaDeudas(categorias, categoria) && deudas.length > 0;
  // Elegir la deuda llena su cuota (si el monto está vacío o era la cuota de otra) y el concepto si falta.
  const elegirDeuda = (d: OpcionDeuda | null) => {
    setDeuda(d?.id ?? "");
    if (d?.cuota && (!monto || deudas.some((x) => x.cuota === monto))) {
      setMonto(d.cuota);
      setMontoInicial(d.cuota);
      setReinicio((n) => n + 1);
    }
    if (d && !concepto.trim()) setConcepto(`Cuota ${d.nombre}`);
  };

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="fecha" value={hoy} />
      <input type="hidden" name="account_id" value={cuenta} />
      <input type="hidden" name="category_id" value={categoria} />
      <input type="hidden" name="estado" value={pagado ? "confirmado" : "programado"} />

      {!soloGasto && (
        <SelectorTipo
          tipo={tipo}
          incluirTransferencia={false}
          onCambio={(t) => {
            setTipo(t as "gasto" | "ingreso");
            setElegida("");
          }}
        />
      )}

      {enDolares && trm ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] leading-[18px] font-semibold text-cuerpo" htmlFor="registro-usd">
            ¿Cuánto? (en dólares)
          </label>
          <input
            id="registro-usd"
            name="usd"
            inputMode="decimal"
            autoFocus
            value={dolares}
            onChange={(e) => setDolares(e.target.value.replace(/[^\d.,]/g, ""))}
            placeholder="US$ 12,99"
            className={`${claseControl} h-14 text-2xl font-bold`}
          />
          <span className="text-[13px] text-cuerpo">
            {Number(dolares.replace(",", ".")) > 0
              ? `≈ ${formatearCOP(Math.round(Number(dolares.replace(",", ".")) * trm))} con la TRM de ${formatearCOP(Math.round(trm))}`
              : `Se convierte a pesos con la TRM de ${formatearCOP(Math.round(trm))}`}
          </span>
        </div>
      ) : (
        <CampoMonto key={reinicio} etiqueta="¿Cuánto?" name="monto" grande autoFocus enterKeyHint="next" valorInicial={montoInicial} onCambio={setMonto} />
      )}
      {trm ? (
        <button type="button" onClick={() => setEnDolares(!enDolares)} className="-mt-2 self-start text-[13px] font-semibold text-cuerpo underline-offset-4 hover:underline">
          {enDolares ? "Escribirlo en pesos" : "¿Pagaste en dólares?"}
        </button>
      ) : null}

      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="text-[13px] leading-[18px] font-semibold text-cuerpo">¿En qué?</span>
        <input
          name="comercio"
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          maxLength={200}
          autoComplete="off"
          enterKeyHint="done"
          placeholder={tipo === "gasto" ? "Droguería, mercado, gasolina…" : "Salario, honorarios, venta…"}
          className={claseControl}
        />
      </label>

      {recientes.length > 0 && !concepto && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Recientes">
          <span className="mr-1 text-[13px] text-tenue">Recientes:</span>
          {recientes.map((s) => (
            <button
              key={s.texto}
              type="button"
              onClick={() => {
                setConcepto(s.texto);
                setCuenta(s.account_id && cuentas.some((c) => c.id === s.account_id) ? s.account_id : cuenta);
              }}
              className="inline-flex h-9 items-center rounded-full border border-control bg-elevada px-3 text-sm hover:bg-mosaico"
            >
              {s.texto}
            </button>
          ))}
        </div>
      )}

      {categoria && !cambiar && (
        <div data-guia="sugerencia" className="flex items-start gap-2.5 rounded-xl bg-seleccion px-3.5 py-3 text-sm leading-[21px]">
          <span className="mt-px shrink-0">
            <Icono nombre={iconoCategoria(porId.get(categoria)?.etiqueta, tipo)} tamano={20} />
          </span>
          <span>
            Lo pondremos en <b>{porId.get(categoria)?.etiqueta}</b>
            {nombreCuenta && (
              <>
                {" "}
                y {tipo === "gasto" ? "lo pagaste desde" : "entró a"} <b>{nombreCuenta}</b>
              </>
            )}
            .{" "}
            <button type="button" onClick={() => setCambiar(true)} className="font-bold underline">
              Cambiar
            </button>
          </span>
        </div>
      )}

      {!categoria && !abierto && (
        <p data-guia="elegir-categoria" className="text-[13px] text-tenue">
          Escribe en qué fue y te sugerimos la categoría, o{" "}
          <button type="button" onClick={() => setCambiar(true)} className="font-bold text-tinta underline">
            elígela tú
          </button>
          .
        </p>
      )}

      {abierto && (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] leading-[18px] font-semibold text-cuerpo">¿En qué categoría va?</legend>
            <div className="flex flex-wrap gap-2">
              {chips.map((id) => (
                <button key={id} type="button" className={chip(categoria === id, true)} onClick={() => setElegida(id)} aria-pressed={categoria === id}>
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
              onChange={(e) => setElegida(e.target.value)}
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
            <legend className="mb-2 text-[13px] leading-[18px] font-semibold text-cuerpo">{tipo === "gasto" ? "¿De dónde salió?" : "¿A dónde entró?"}</legend>
            <div className="flex flex-wrap gap-2">
              {cuentas.map((c) => (
                <button key={c.id} type="button" className={chip(cuenta === c.id)} onClick={() => setCuenta(c.id)} aria-pressed={cuenta === c.id}>
                  {c.nombre}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}

      {conDeuda && <CampoDeuda deudas={deudas} valor={deuda} onCambio={elegirDeuda} />}

      {tipo === "gasto" && (
        <div role="radiogroup" aria-label="Estado" className="inline-flex gap-1 self-start rounded-[10px] bg-mosaico p-1">
          <button type="button" role="radio" aria-checked={pagado} onClick={() => setPagado(true)} className={seg(pagado)}>
            Ya lo pagué
          </button>
          <button type="button" role="radio" aria-checked={!pagado} onClick={() => setPagado(false)} className={seg(!pagado)}>
            Lo pago después
          </button>
        </div>
      )}

      <Link href="/movimientos/nuevo" className="self-start text-sm font-semibold hover:underline">
        + Más detalles: fecha, quién, negocio, renta, transferencias
      </Link>

      {estado?.error && <Aviso>{estado.error}</Aviso>}
      {estado?.ok && (
        <Aviso tipo="ok">
          {estado.ok}{" "}
          <Link href="/movimientos" className="font-semibold underline">
            Ver movimientos
          </Link>
        </Aviso>
      )}

      <div className="sticky bottom-0 -mx-5 flex items-center justify-end gap-3 border-t border-divisor bg-elevada px-5 pt-4 pb-[max(20px,env(safe-area-inset-bottom))] md:-mx-6 md:px-6 lg:static">
        <span className="mr-auto hidden text-[13px] text-tenue lg:inline">
          <kbd className="inline-flex h-[22px] items-center rounded-md border border-borde bg-pagina px-1.5 text-xs text-cuerpo">Enter</kbd> guarda
        </span>
        {/* «Guardar» va primero en el DOM: es el que usa Enter. */}
        <BotonEnviar disabled={!categoria || !cuenta} className="order-3 min-w-[140px]">
          Guardar
        </BotonEnviar>
        <BotonEnviar name="seguir" value="1" variante="secundario" disabled={!categoria || !cuenta} className="order-2">
          Guardar y otro
        </BotonEnviar>
      </div>
    </form>
  );
}
