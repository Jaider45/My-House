import { fechaVersion, PENDIENTES } from "@/lib/legal/responsable";

/** Piezas de los documentos legales: mismos estilos en términos y política. */

export function Encabezado({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <header className="mb-8 space-y-2">
      {PENDIENTES.length > 0 && (
        <p className="rounded-lg border border-alerta bg-alerta-fondo px-3 py-2 text-sm text-alerta-tinta">
          Borrador: faltan los datos del responsable ({PENDIENTES.join(", ")}).
        </p>
      )}
      <h1 className="text-[28px] leading-[34px] font-bold md:text-[32px] md:leading-[38px]">{titulo}</h1>
      <p className="text-sm text-tenue">Versión del {fechaVersion()}</p>
      {children}
    </header>
  );
}

export function Seccion({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 pt-4" id={`s${n}`}>
      <h2 className="text-lg leading-7 font-bold">
        {n}. {titulo}
      </h2>
      {children}
    </section>
  );
}

export function Lista({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 marker:text-tenue">{children}</ul>;
}
