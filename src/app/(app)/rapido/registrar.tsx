"use client";

import Link from "next/link";
import { useActionState, useCallback, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Aviso, clasesBoton, cx } from "@/components/ui";
import { Icono, type NombreIcono } from "@/components/marca";
import { MarcoVentana } from "@/components/ui/ventana";
import { BotonGuia } from "@/components/guia/boton-guia";
import { comprimir } from "../comprobantes/chat";
import { enviarAlAsistente } from "../comprobantes/acciones";
import { RegistroRapido, type Sugerencia } from "./registro-rapido";
import type { Categoria } from "@/lib/categorias";
import type { CuentaOpcion } from "@/lib/catalogos";

export type DatosEscribir = { cuentas: CuentaOpcion[]; categorias: Categoria[]; frecuentes: string[]; sugerencias: Sugerencia[]; hoy: string };

export type Modo = "escribir" | "foto" | "whatsapp";

const MODOS: { id: Modo; texto: string; icono: NombreIcono }[] = [
  { id: "escribir", texto: "Escribirlo", icono: "egresos" },
  { id: "foto", texto: "Foto o PDF", icono: "documentos" },
  { id: "whatsapp", texto: "Por WhatsApp", icono: "conectividad" },
];

/**
 * Registrar movimiento (diseño «Registrar»): ventana con tres formas de registrar. Abierta sobre la pantalla en la
 * que estabas (ruta interceptada) se cierra volviendo atrás; abierta directo (enlace, recarga) vuelve a Inicio.
 */
export function VentanaRegistrar({
  datos,
  sinCuentas,
  iaLista,
  sobrePantalla,
}: {
  /** Datos de «Escribirlo»; null = rol de solo lectura. */
  datos: DatosEscribir | null;
  sinCuentas?: boolean;
  iaLista: boolean;
  /** Se abrió encima de otra pantalla (ruta interceptada). */
  sobrePantalla: boolean;
}) {
  const router = useRouter();
  const inicial = useSearchParams().get("modo");
  const [modo, setModo] = useState<Modo>(inicial === "foto" || inicial === "whatsapp" ? inicial : "escribir");
  const cerrar = useCallback(() => (sobrePantalla ? router.back() : router.push("/")), [router, sobrePantalla]);

  return (
    <MarcoVentana
      titulo="Registrar movimiento"
      alCerrar={cerrar}
      guia="registrar"
      accionesTitulo={<BotonGuia id="gasto" className="h-10" />}
    >
      <div role="tablist" aria-label="Cómo registrar" className="mb-4 grid grid-cols-3 gap-2">
        {MODOS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={modo === m.id}
            data-guia={`modo-${m.id}`}
            onClick={() => setModo(m.id)}
            className={cx(
              "flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-sm font-semibold",
              modo === m.id ? "border-2 border-monte bg-seleccion" : "border border-control bg-elevada hover:bg-mosaico",
            )}
          >
            <Icono nombre={m.icono} tamano={24} />
            {m.texto}
          </button>
        ))}
      </div>
      {modo === "escribir" &&
        (!datos ? (
          <div className="pb-5">
            <Aviso>Tu rol es de solo lectura.</Aviso>
          </div>
        ) : sinCuentas ? (
          <div className="space-y-3 pb-5">
            <Aviso tipo="info">Para registrar, primero crea una cuenta (banco, efectivo o tarjeta).</Aviso>
            <Link href="/cuentas?nuevo=1" className={clasesBoton("primario", "w-full")}>
              Crear cuenta
            </Link>
          </div>
        ) : (
          <RegistroRapido {...datos} alGuardar={cerrar} />
        ))}
      {modo === "foto" && <SubirComprobantes habilitado={iaLista} />}
      {modo === "whatsapp" && <PorWhatsApp />}
    </MarcoVentana>
  );
}

/** «Foto o PDF»: sube al asistente de comprobantes (los lee, los registra y pregunta lo que no sepa). */
function SubirComprobantes({ habilitado }: { habilitado: boolean }) {
  const [archivos, setArchivos] = useState<File[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const adjuntar = useRef<HTMLInputElement>(null);
  const camara = useRef<HTMLInputElement>(null);
  const [estado, accion, enviando] = useActionState(async (previo: Awaited<ReturnType<typeof enviarAlAsistente>>, datos: FormData) => {
    datos.delete("archivos");
    const listos = await Promise.all(archivos.map(comprimir));
    const grande = listos.find((a) => a.size > 10 * 1024 * 1024);
    if (grande) return { error: `${grande.name} pesa más de 10 MB. Para extractos largos usa Importar extracto.` };
    for (const a of listos) datos.append("archivos", a);
    const r = await enviarAlAsistente(previo, datos);
    if (!r?.error) setArchivos([]);
    return r;
  }, null);
  const agregar = (lista: FileList | null) => setArchivos((a) => [...a, ...Array.from(lista ?? [])].slice(0, 5));

  if (!habilitado)
    return (
      <div className="pb-5">
        <Aviso tipo="info">El asistente de comprobantes no está configurado en este hogar. Puedes escribir el gasto en «Escribirlo».</Aviso>
      </div>
    );
  return (
    <form action={accion} className="flex flex-col gap-3 pb-5">
      <input ref={adjuntar} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => (agregar(e.target.files), (e.target.value = ""))} />
      <input ref={camara} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (agregar(e.target.files), (e.target.value = ""))} />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          agregar(e.dataTransfer.files);
        }}
        className={cx("flex flex-col items-center gap-2.5 rounded-2xl border-2 border-dashed bg-pagina px-5 py-7 text-center", arrastrando ? "border-teja" : "border-control")}
      >
        <Icono nombre="documentos" tamano={36} />
        <b className="text-[17px]">Toma una foto o suelta aquí la factura</b>
        <span className="text-sm text-cuerpo">
          Sirve foto, PDF o captura de Nequi o Daviplata. Leemos comercio, fecha y monto, y te preguntamos solo lo que no sepamos.
        </span>
        <div className="flex flex-wrap justify-center gap-2.5">
          <button type="button" onClick={() => camara.current?.click()} className={clasesBoton("primario")}>
            Tomar foto
          </button>
          <button type="button" onClick={() => adjuntar.current?.click()} className={clasesBoton("secundario")}>
            Elegir archivo
          </button>
        </div>
      </div>
      {archivos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {archivos.map((a, i) => (
            <span key={`${a.name}-${i}`} className="inline-flex items-center gap-2 rounded-[10px] bg-seleccion py-1.5 pr-1 pl-2.5 text-[13px]">
              <span className="max-w-[180px] truncate">{a.name}</span>
              <button type="button" aria-label={`Quitar ${a.name}`} onClick={() => setArchivos(archivos.filter((_, j) => j !== i))} className="size-8 rounded-md hover:bg-mosaico">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {estado?.error && <Aviso>{estado.error}</Aviso>}
      {estado?.ok && (
        <Aviso tipo="ok">
          {estado.ok}{" "}
          <Link href="/comprobantes" className="font-semibold underline">
            Ver en el asistente
          </Link>
        </Aviso>
      )}
      <p className="text-[13px] text-tenue">Puedes subir hasta 5 a la vez. Quedan como soporte para la renta.</p>
      {archivos.length > 0 && (
        <button type="submit" disabled={enviando} className={clasesBoton("primario", "self-end")}>
          {enviando ? `Leyendo ${archivos.length > 1 ? `${archivos.length} comprobantes` : "el comprobante"}…` : `Enviar ${archivos.length > 1 ? `${archivos.length} comprobantes` : "comprobante"}`}
        </button>
      )}
    </form>
  );
}

/** «Por WhatsApp»: así funcionará; el canal aún no está conectado (decisión 36: el webhook solo registra eventos). */
function PorWhatsApp() {
  return (
    <div className="flex flex-col gap-3 pb-5">
      <div className="flex flex-col gap-2 rounded-2xl bg-[#e9f3ee] p-4">
        <span className="self-end rounded-xl rounded-br-[4px] bg-[#d9fdd3] px-3 py-2 text-[15px]">almuerzo 32 mil nequi</span>
        <span className="max-w-[85%] self-start rounded-xl rounded-bl-[4px] bg-white px-3 py-2 text-[15px]">
          <b>My House</b>
          <br />
          Registré $32.000 en Restaurantes y salidas desde Nequi. ¿Está bien?
        </span>
      </div>
      <p className="text-[15px] leading-[23px] text-cuerpo">
        Escribe el gasto como se lo dirías a alguien, o reenvía la foto de la factura, y te confirmamos en el mismo chat.
      </p>
      <Aviso tipo="info">Muy pronto: estamos conectando My House con WhatsApp. Mientras tanto, usa «Escribirlo» o «Foto o PDF».</Aviso>
    </div>
  );
}
