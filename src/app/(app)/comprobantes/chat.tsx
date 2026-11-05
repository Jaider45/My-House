"use client";

import { useActionState, useRef, useState } from "react";
import { Aviso, cx } from "@/components/ui";
import { enviarAlAsistente } from "./acciones";

/** Reduce fotos grandes a 1600 px en JPEG antes de subirlas: menos espera y menos datos móviles. */
async function comprimir(archivo: File): Promise<File> {
  if (!archivo.type.startsWith("image/") || archivo.size < 600_000) return archivo;
  try {
    const imagen = await createImageBitmap(archivo);
    const escala = Math.min(1, 1600 / Math.max(imagen.width, imagen.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(imagen.width * escala);
    lienzo.height = Math.round(imagen.height * escala);
    lienzo.getContext("2d")!.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    const blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, "image/jpeg", 0.82));
    return blob ? new File([blob], archivo.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : archivo;
  } catch {
    return archivo; // formatos que el navegador no decodifica (p. ej. HEIC fuera de Safari) van tal cual
  }
}

const etiqueta = (f: File) => (f.type === "application/pdf" ? "PDF" : (f.type.split("/")[1] ?? "IMG").toUpperCase().replace("JPEG", "JPG"));

export function Compositor({ habilitado }: { habilitado: boolean }) {
  const [archivos, setArchivos] = useState<File[]>([]);
  const [texto, setTexto] = useState("");
  const [arrastrando, setArrastrando] = useState(false);
  const adjuntar = useRef<HTMLInputElement>(null);
  const camara = useRef<HTMLInputElement>(null);

  const [estado, accion, enviando] = useActionState(async (previo: Awaited<ReturnType<typeof enviarAlAsistente>>, datos: FormData) => {
    datos.delete("archivos");
    for (const a of await Promise.all(archivos.map(comprimir))) datos.append("archivos", a);
    const r = await enviarAlAsistente(previo, datos);
    if (!r?.error) {
      setArchivos([]);
      setTexto("");
    }
    return r;
  }, null);

  const agregar = (lista: FileList | null) => setArchivos((a) => [...a, ...Array.from(lista ?? [])].slice(0, 5));

  return (
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
      className={cx("sticky bottom-[calc(76px+env(safe-area-inset-bottom))] rounded-b-2xl bg-elevada lg:bottom-0", arrastrando && "ring-2 ring-teja")}
    >
      {estado?.error && (
        <div className="px-3 pt-3">
          <Aviso>{estado.error}</Aviso>
        </div>
      )}
      {archivos.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-3">
          {archivos.map((a, i) => (
            <span key={`${a.name}-${i}`} className="inline-flex items-center gap-2 rounded-[10px] bg-seleccion py-1.5 pr-1 pl-1.5 text-[13px]">
              <span className="inline-flex h-9 w-8 items-center justify-center rounded-md bg-monte text-[10px] font-bold text-arena">{etiqueta(a)}</span>
              <span className="max-w-[160px] truncate">{a.name}</span>
              <button type="button" aria-label={`Quitar ${a.name}`} onClick={() => setArchivos(archivos.filter((_, j) => j !== i))} className="size-8 rounded-md hover:bg-mosaico">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <form action={accion} className="flex items-center gap-1.5 border-t border-divisor p-2.5 md:gap-2 md:p-3">
        <input ref={adjuntar} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => (agregar(e.target.files), (e.target.value = ""))} />
        <input ref={camara} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (agregar(e.target.files), (e.target.value = ""))} />
        <button type="button" aria-label="Adjuntar archivo" disabled={!habilitado} onClick={() => adjuntar.current?.click()} className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg hover:bg-mosaico disabled:opacity-50">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 11.5l-8.5 8.5a5 5 0 0 1-7-7L14 4.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3l8-8" />
          </svg>
        </button>
        <button type="button" aria-label="Tomar foto" disabled={!habilitado} onClick={() => camara.current?.click()} className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg hover:bg-mosaico disabled:opacity-50">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
        </button>
        <label className="sr-only" htmlFor="chat-texto">
          Mensaje
        </label>
        <input
          id="chat-texto"
          name="texto"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          disabled={!habilitado}
          autoComplete="off"
          placeholder={habilitado ? "Escribe o adjunta fotos, PDF o capturas" : "El asistente no está configurado"}
          className="h-12 min-w-0 flex-1 rounded-full border border-control bg-elevada px-4 text-[15px] outline-none focus:border-monte"
        />
        <button
          type="submit"
          aria-label="Enviar"
          disabled={!habilitado || enviando || (!texto.trim() && !archivos.length)}
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-monte text-arena disabled:opacity-50"
        >
          {enviando ? (
            <span className="size-5 animate-spin rounded-full border-2 border-arena border-t-transparent" aria-hidden />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          )}
        </button>
      </form>
      {enviando && <p className="px-4 pb-3 text-[13px] text-cuerpo">Leyendo {archivos.length > 1 ? `${archivos.length} comprobantes` : "el comprobante"}…</p>}
      <p className="mx-3 mb-3 hidden rounded-xl border-[1.5px] border-dashed border-control px-3.5 py-2.5 text-center text-[13px] text-cuerpo md:block">
        Suelta aquí fotos de facturas, recibos en PDF o capturas de Nequi o Daviplata. También puedes escribir «almuerzo 25 mil con la Visa».
      </p>
    </div>
  );
}
