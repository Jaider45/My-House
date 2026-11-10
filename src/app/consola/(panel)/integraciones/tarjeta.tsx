"use client";

import { useActionState, useState } from "react";
import { Boton, Chip, cx, type Tono } from "@/components/ui";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { MensajeEstado } from "@/components/ui/estado";
import { FormularioAccion } from "@/components/ui/formulario-accion";
import type { Integracion } from "@/lib/integraciones/catalogo";
import { desconectarIntegracion, enviarCorreoPrueba, enviarWhatsappPrueba, guardarIntegracion, probarIntegracion } from "./acciones";

export type Guardada = {
  config: Record<string, string>;
  secretos: Record<string, { ultimos: string }>;
  verificada_en: string | null;
  verificacion: { ok: boolean; detalle: string } | null;
  ultimo_evento: string | null;
  actualizada: string;
} | null;

type Props = { def: Integracion; guardada: Guardada; enEntorno: boolean; webhook: string | null; verificada: string | null; evento: string | null };

function estado(g: Guardada, enEntorno: boolean): { texto: string; tono: Tono } {
  if (!g) return enEntorno ? { texto: "Variables del servidor", tono: "info" } : { texto: "No conectada", tono: "neutro" };
  if (!g.verificacion) return { texto: "Sin probar", tono: "alerta" };
  return g.verificacion.ok ? { texto: "Conectada", tono: "ok" } : { texto: "Con error", tono: "error" };
}

function Copiar({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const [hecho, setHecho] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-cuerpo">{etiqueta}</span>
      <div className="flex gap-2">
        <input readOnly value={valor} aria-label={etiqueta} className="h-9 min-w-0 flex-1 rounded-lg border border-control bg-pagina px-2 text-xs text-cuerpo" />
        <Boton type="button" variante="secundario" className="h-9 px-3 text-sm" onClick={() => navigator.clipboard.writeText(valor).then(() => setHecho(true))}>
          {hecho ? "Copiado" : "Copiar"}
        </Boton>
      </div>
    </div>
  );
}

/** Una integración: estado, campos (los secretos nunca se muestran: solo sus últimos 4), conectar, probar y desconectar. */
export function TarjetaIntegracion({ def, guardada, enEntorno, webhook, verificada, evento }: Props) {
  const [guardar, enviarGuardar] = useActionState(guardarIntegracion, null);
  const [prueba, enviarPrueba] = useActionState(probarIntegracion, null);
  const e = estado(guardada, enEntorno);
  const plantillas = (prueba?.plantillas ?? guardar?.plantillas) || null;
  const verifyToken = guardada?.config.verify_token;

  return (
    <section className={cx("flex flex-col gap-4 rounded-2xl border bg-elevada p-4 md:p-6", e.tono === "ok" ? "border-monte" : "border-borde")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] leading-[22px] font-bold md:text-xl md:leading-[26px]">{def.nombre}</h2>
          <p className="mt-0.5 text-sm text-cuerpo">{def.descripcion}</p>
        </div>
        <Chip tono={e.tono}>{e.texto}</Chip>
      </div>

      {guardada?.verificacion && (
        <p className={cx("text-sm", guardada.verificacion.ok ? "text-ok-tinta" : "text-error-tinta")}>
          {guardada.verificacion.detalle}
          {verificada && <span className="text-tenue"> · probada {verificada}</span>}
        </p>
      )}
      {evento && <p className="text-sm text-cuerpo">Último evento recibido: {evento}</p>}
      {!guardada && enEntorno && <p className="text-sm text-cuerpo">Hoy funciona con las variables de entorno del servidor. Conéctala aquí para cambiarla sin desplegar.</p>}

      <form action={enviarGuardar} className="flex flex-col gap-3">
        <input type="hidden" name="proveedor" value={def.proveedor} />
        {def.campos.map((c) => {
          const ultimos = guardada?.secretos[c.clave]?.ultimos;
          return (
            <label key={c.clave} className="flex flex-col gap-1.5 text-[13px] font-semibold text-cuerpo">
              <span>
                {c.etiqueta}
                {c.opcional && <span className="font-normal text-tenue"> · opcional</span>}
              </span>
              <input
                name={c.clave}
                type={c.secreto ? "password" : "text"}
                autoComplete="off"
                spellCheck={false}
                defaultValue={c.secreto ? "" : (guardada?.config[c.clave] ?? "")}
                placeholder={c.secreto && ultimos ? `Guardado (${ultimos}). Escribe para cambiarlo.` : c.placeholder}
                required={!c.opcional && !(c.secreto && ultimos) && c.clave !== "remitente"}
                className="h-10 rounded-lg border border-control bg-elevada px-3 font-mono text-[14px] font-normal text-tinta"
              />
              {c.ayuda && <span className="text-xs font-normal text-tenue">{c.ayuda}</span>}
            </label>
          );
        })}
        <MensajeEstado estado={guardar} />
        <BotonEnviar pendiente="Conectando y probando…">{guardada ? "Guardar y probar" : "Conectar"}</BotonEnviar>
      </form>

      {(webhook || verifyToken) && (
        <div className="flex flex-col gap-3 rounded-xl bg-pagina p-3">
          {webhook && <Copiar etiqueta="URL para el webhook (pégala en el panel del proveedor)" valor={webhook} />}
          {verifyToken && <Copiar etiqueta="Token de verificación" valor={verifyToken} />}
        </div>
      )}

      {(guardada || enEntorno) && (
        <div className="flex flex-wrap items-start gap-2">
          <form action={enviarPrueba}>
            <input type="hidden" name="proveedor" value={def.proveedor} />
            <BotonEnviar variante="secundario" className="h-9 text-sm" pendiente="Probando…">
              Probar conexión
            </BotonEnviar>
          </form>
          {def.proveedor === "resend" && (
            <FormularioAccion accion={enviarCorreoPrueba} className="flex flex-col">
              <BotonEnviar variante="secundario" className="h-9 text-sm" pendiente="Enviando…">
                Enviar correo de prueba
              </BotonEnviar>
            </FormularioAccion>
          )}
          {guardada && (
            <FormularioAccion accion={desconectarIntegracion} className="ml-auto flex flex-col">
              <input type="hidden" name="proveedor" value={def.proveedor} />
              <BotonEnviar variante="peligro" className="h-9 text-sm" pendiente="…">
                Desconectar
              </BotonEnviar>
            </FormularioAccion>
          )}
        </div>
      )}
      <MensajeEstado estado={prueba} />

      {def.proveedor === "whatsapp" && guardada && <PruebaWhatsapp />}

      {plantillas && plantillas.length > 0 && (
        <div className="flex flex-col">
          <span className="mb-1 text-[13px] font-semibold text-cuerpo">Plantillas en Meta</span>
          {plantillas.map((t) => (
            <div key={`${t.name}-${t.language}`} className="flex min-h-9 items-center justify-between gap-3 border-b border-divisor text-sm last:border-0">
              <span className="font-mono">{t.name}</span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-tenue">
                  {t.category.toLowerCase()} · {t.language}
                </span>
                <Chip tono={t.status === "APPROVED" ? "ok" : t.status === "REJECTED" ? "error" : "alerta"}>
                  {t.status === "APPROVED" ? "Aprobada" : t.status === "REJECTED" ? "Rechazada" : "En revisión"}
                </Chip>
              </span>
            </div>
          ))}
        </div>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer font-semibold">Cómo conectarla</summary>
        <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-cuerpo">
          {def.pasos.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
        <a href={def.docs} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-semibold underline-offset-4 hover:underline">
          Documentación del proveedor ↗
        </a>
      </details>
    </section>
  );
}

function PruebaWhatsapp() {
  return (
    <FormularioAccion accion={enviarWhatsappPrueba} className="flex flex-col gap-2 rounded-xl bg-pagina p-3">
      <span className="text-[13px] font-semibold text-cuerpo">Enviar mensaje de prueba</span>
      <div className="flex flex-wrap gap-2">
        <input name="numero" inputMode="tel" required placeholder="573001234567" aria-label="Número con indicativo" className="h-9 min-w-0 flex-1 rounded-lg border border-control bg-elevada px-2 text-sm" />
        <input name="plantilla" defaultValue="hello_world" aria-label="Plantilla" className="h-9 w-36 rounded-lg border border-control bg-elevada px-2 font-mono text-sm" />
        <BotonEnviar variante="secundario" className="h-9 text-sm" pendiente="Enviando…">
          Enviar
        </BotonEnviar>
      </div>
      <span className="text-xs text-tenue">«hello_world» viene aprobada en toda cuenta nueva. El número debe estar autorizado mientras la app esté en modo desarrollo.</span>
    </FormularioAccion>
  );
}
