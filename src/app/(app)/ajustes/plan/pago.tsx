"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Aviso, Boton, cx } from "@/components/ui";
import { MarcoVentana } from "@/components/ui/ventana";
import { formatearCOP } from "@/lib/dinero";
import { celularValido, errorTarjeta, formatearTarjeta, formatearVence, marcaDe, soloDigitos, tokenizarTarjeta } from "@/lib/pagos/cliente";
import { pagarEnApp, revisarPago, type EntradaPago } from "./acciones";

export type DatosPago = {
  llavePublica: string;
  /** Reglamento de Wompi y autorización de datos personales (enlaces vigentes del comercio). */
  terminos: string | null;
  datosUrl: string | null;
  guardada: { marca: string | null; ultimos4: string | null } | null;
  puedeGuardar: boolean;
};

type Medio = "guardada" | "tarjeta" | "nequi";
type Fase = { tipo: "formulario" } | { tipo: "procesando"; texto: string } | { tipo: "esperando"; id: string; nequi: boolean } | { tipo: "aprobado"; texto: string };

const campo = "h-11 w-full rounded-[10px] border border-control bg-elevada px-3 text-[16px] placeholder:text-tenue focus:border-monte focus:outline-none";
const etiqueta = "text-[13px] font-semibold text-cuerpo";

/**
 * Pago dentro de la app. Los datos de la tarjeta viven solo en este componente: se envían directo a Wompi para
 * tokenizarlos (los campos no tienen `name` y no hacen parte de ningún formulario que llegue a nuestro servidor).
 */
export function VentanaPago({
  datos,
  monto,
  concepto,
  cobro,
  alCerrar,
}: {
  datos: DatosPago;
  monto: number;
  concepto: string;
  cobro: EntradaPago["cobro"];
  alCerrar: () => void;
}) {
  const router = useRouter();
  const [medio, setMedio] = useState<Medio>(datos.guardada ? "guardada" : "tarjeta");
  const [fase, setFase] = useState<Fase>({ tipo: "formulario" });
  const [error, setError] = useState<string | null>(null);
  const [numero, setNumero] = useState("");
  const [vence, setVence] = useState("");
  const [cvc, setCvc] = useState("");
  const [titular, setTitular] = useState("");
  const [cuotas, setCuotas] = useState(1);
  const [guardar, setGuardar] = useState(datos.puedeGuardar);
  const [celular, setCelular] = useState("");
  const [acepta, setAcepta] = useState(false);
  const vivo = useRef(true);
  useEffect(() => () => void (vivo.current = false), []);

  // Mientras Wompi no responda (Nequi espera que la persona apruebe en su celular), se pregunta cada 2,5 s.
  useEffect(() => {
    if (fase.tipo !== "esperando") return;
    const limite = Date.now() + (fase.nequi ? 5 * 60_000 : 2 * 60_000);
    let cancelado = false;
    const revisar = async () => {
      while (!cancelado && vivo.current && Date.now() < limite) {
        await new Promise((r) => setTimeout(r, 2500));
        if (cancelado) return;
        const r = await revisarPago(fase.id);
        if (r.estado === "APPROVED") {
          setFase({ tipo: "aprobado", texto: r.mensaje });
          router.refresh();
          return;
        }
        if (r.estado !== "PENDING") {
          setError(r.mensaje);
          setFase({ tipo: "formulario" });
          return;
        }
      }
      if (!cancelado) {
        setError("La pasarela aún no confirma el pago. Si lo aprobaste, se verá reflejado en unos minutos y te llegará el recibo por correo.");
        setFase({ tipo: "formulario" });
      }
    };
    void revisar();
    return () => {
      cancelado = true;
    };
  }, [fase, router]);

  async function pagar() {
    setError(null);
    if (!acepta) return setError("Para pagar acepta el reglamento de Wompi y la autorización de datos.");
    let entrada: EntradaPago["medio"];
    if (medio === "nequi") {
      if (!celularValido(celular)) return setError("Escribe el celular de Nequi (10 dígitos).");
      entrada = { tipo: "nequi", telefono: soloDigitos(celular) };
    } else if (medio === "guardada") {
      entrada = { tipo: "guardada", cuotas };
    } else {
      const e = errorTarjeta({ numero, vence, cvc, titular });
      if (e) return setError(e);
      setFase({ tipo: "procesando", texto: "Validando la tarjeta…" });
      try {
        const t = await tokenizarTarjeta(datos.llavePublica, { numero, vence, cvc, titular });
        entrada = { tipo: "tarjeta", token: t.token, marca: t.marca, ultimos4: t.ultimos4, vence: t.vence, titular: t.titular, cuotas, guardar: guardar && datos.puedeGuardar };
      } catch (err) {
        setFase({ tipo: "formulario" });
        return setError(err instanceof Error ? err.message : "La tarjeta no se pudo validar.");
      }
    }
    setFase({ tipo: "procesando", texto: medio === "nequi" ? "Enviando la solicitud a Nequi…" : "Procesando el pago…" });
    const r = await pagarEnApp({ cobro, medio: entrada, acepta: true });
    if ("error" in r) {
      setFase({ tipo: "formulario" });
      return setError(r.error);
    }
    // Ya no hace falta tener la tarjeta en memoria.
    setNumero("");
    setCvc("");
    if ("activado" in r) {
      setFase({ tipo: "aprobado", texto: r.ok });
      router.refresh();
      return;
    }
    if (r.estado === "APPROVED") {
      setFase({ tipo: "aprobado", texto: "¡Pago aprobado! Tu plan ya está activo y te enviamos el recibo por correo." });
      router.refresh();
    } else if (r.estado === "PENDING") setFase({ tipo: "esperando", id: r.transaccion, nequi: medio === "nequi" });
    else {
      setFase({ tipo: "formulario" });
      setError("El pago fue rechazado. Prueba con otra tarjeta o con Nequi.");
    }
  }

  const ocupado = fase.tipo === "procesando" || fase.tipo === "esperando";
  const marca = marcaDe(numero);

  return (
    <MarcoVentana titulo="Pagar el plan" subtitulo={`${concepto} · ${formatearCOP(monto)}`} ancho={520} alCerrar={ocupado ? () => {} : alCerrar}>
      {fase.tipo === "aprobado" ? (
        <div className="flex flex-col gap-4">
          <Aviso tipo="ok">{fase.texto}</Aviso>
          <Boton className="h-11 self-end" onClick={alCerrar}>
            Listo
          </Boton>
        </div>
      ) : fase.tipo === "esperando" ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center" role="status" aria-live="polite">
          <span className="size-10 animate-spin rounded-full border-4 border-monte/20 border-t-monte" aria-hidden="true" />
          <b className="text-[17px]">{fase.nequi ? "Aprueba el pago en tu app de Nequi" : "Confirmando el pago…"}</b>
          <p className="max-w-sm text-sm text-cuerpo">
            {fase.nequi ? "Te llegó una notificación de Nequi. Ábrela y acepta el cobro; esta pantalla se actualiza sola." : "Tu banco está respondiendo. No cierres esta ventana."}
          </p>
        </div>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void pagar();
          }}
        >
          <div role="radiogroup" aria-label="Cómo pagas" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(
              [
                datos.guardada && ["guardada", `${datos.guardada.marca ?? "Tarjeta"} ···${datos.guardada.ultimos4 ?? ""}`],
                ["tarjeta", datos.guardada ? "Otra tarjeta" : "Tarjeta"],
                ["nequi", "Nequi"],
              ].filter(Boolean) as [Medio, string][]
            ).map(([id, texto]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={medio === id}
                onClick={() => {
                  setMedio(id);
                  setError(null);
                }}
                className={cx("min-h-12 rounded-[10px] px-3 text-left text-sm font-semibold", medio === id ? "border-2 border-monte bg-[#eef3f0]" : "border border-control bg-elevada")}
              >
                {texto}
              </button>
            ))}
          </div>

          {medio === "tarjeta" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className={etiqueta} htmlFor="pago-numero">
                  Número de la tarjeta {marca && <span className="font-normal text-tenue">· {marca}</span>}
                </label>
                <input id="pago-numero" className={campo} inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000" value={numero} onChange={(e) => setNumero(formatearTarjeta(e.target.value))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className={etiqueta} htmlFor="pago-vence">
                    Vence (MM/AA)
                  </label>
                  <input id="pago-vence" className={campo} inputMode="numeric" autoComplete="cc-exp" placeholder="12/29" value={vence} onChange={(e) => setVence(formatearVence(e.target.value))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={etiqueta} htmlFor="pago-cvc">
                    Código de seguridad
                  </label>
                  <input id="pago-cvc" className={campo} inputMode="numeric" autoComplete="cc-csc" placeholder="123" maxLength={4} value={cvc} onChange={(e) => setCvc(soloDigitos(e.target.value).slice(0, 4))} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={etiqueta} htmlFor="pago-titular">
                  Nombre como aparece en la tarjeta
                </label>
                <input id="pago-titular" className={campo} autoComplete="cc-name" value={titular} onChange={(e) => setTitular(e.target.value.toUpperCase())} />
              </div>
            </>
          )}

          {(medio === "tarjeta" || medio === "guardada") && (
            <div className="flex flex-col gap-1.5">
              <label className={etiqueta} htmlFor="pago-cuotas">
                Cuotas (tarjeta de crédito)
              </label>
              <select id="pago-cuotas" className={campo} value={cuotas} onChange={(e) => setCuotas(Number(e.target.value))}>
                {[1, 2, 3, 6, 12, 24, 36].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "1 cuota (débito o una sola)" : `${n} cuotas`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {medio === "tarjeta" && datos.puedeGuardar && (
            <label className="flex items-start gap-3 rounded-xl bg-[#f6efe6] p-3.5 text-sm">
              <input type="checkbox" className="mt-0.5 size-5 accent-monte" checked={guardar} onChange={(e) => setGuardar(e.target.checked)} />
              <span>
                <b>Guardar la tarjeta y renovar solo</b>
                <br />
                <span className="text-cuerpo">Cobramos cada renovación con esta tarjeta y te avisamos 3 días antes. La quitas cuando quieras.</span>
              </span>
            </label>
          )}

          {medio === "nequi" && (
            <div className="flex flex-col gap-1.5">
              <label className={etiqueta} htmlFor="pago-nequi">
                Celular de Nequi
              </label>
              <input id="pago-nequi" className={campo} inputMode="tel" autoComplete="tel-national" placeholder="300 123 4567" value={celular} onChange={(e) => setCelular(e.target.value)} />
              <span className="text-[13px] text-tenue">Te llega una notificación en la app de Nequi para aprobar el pago.</span>
            </div>
          )}

          <label className="flex items-start gap-3 text-[13px] leading-5 text-cuerpo">
            <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-monte" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
            <span>
              Acepto el{" "}
              {datos.terminos ? (
                <a className="font-semibold text-tinta underline" href={datos.terminos} target="_blank" rel="noreferrer">
                  reglamento de Wompi
                </a>
              ) : (
                "reglamento de Wompi"
              )}{" "}
              y autorizo el{" "}
              {datos.datosUrl ? (
                <a className="font-semibold text-tinta underline" href={datos.datosUrl} target="_blank" rel="noreferrer">
                  tratamiento de mis datos personales
                </a>
              ) : (
                "tratamiento de mis datos personales"
              )}{" "}
              para procesar el pago.
            </span>
          </label>

          {error && (
            <p role="alert" className="rounded-[10px] bg-error-fondo p-3 text-sm font-semibold text-error-tinta">
              {error}
            </p>
          )}

          <div className="sticky bottom-0 -mx-1 flex flex-col-reverse gap-2 bg-elevada px-1 pt-1 sm:flex-row sm:justify-end">
            <Boton type="button" variante="fantasma" onClick={alCerrar} disabled={ocupado}>
              Cancelar
            </Boton>
            <Boton type="submit" className="h-11 min-w-44" disabled={ocupado}>
              {fase.tipo === "procesando" ? fase.texto : `Pagar ${formatearCOP(monto)}`}
            </Boton>
          </div>
          <p className="text-center text-xs text-tenue">
            <span aria-hidden="true">🔒</span> Pago seguro procesado por Wompi (Bancolombia). My House no guarda el número de tu tarjeta.
          </p>
        </form>
      )}
    </MarcoVentana>
  );
}

/** Botón que abre la ventana de pago (para un cobro pendiente o un plan elegido). */
export function BotonPagar({ datos, monto, concepto, cobro, texto, className }: { datos: DatosPago; monto: number; concepto: string; cobro: EntradaPago["cobro"]; texto: string; className?: string }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <Boton type="button" className={cx("h-11", className)} onClick={() => setAbierta(true)}>
        {texto}
      </Boton>
      {/* En el body: el botón vive dentro del formulario del cupón y un formulario no puede ir dentro de otro. */}
      {abierta && createPortal(<VentanaPago datos={datos} monto={monto} concepto={concepto} cobro={cobro} alCerrar={() => setAbierta(false)} />, document.body)}
    </>
  );
}
