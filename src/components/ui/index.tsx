import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export const estilosBoton = {
  primario: "bg-teal-700 text-white hover:bg-teal-800 disabled:bg-teal-700/50",
  secundario: "bg-white text-zinc-900 ring-1 ring-zinc-300 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700",
  peligro: "bg-white text-red-700 ring-1 ring-red-300 hover:bg-red-50 dark:bg-zinc-900 dark:ring-red-900",
} as const;

export function clasesBoton(variante: keyof typeof estilosBoton = "primario", extra?: string) {
  return cx(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed",
    estilosBoton[variante],
    extra,
  );
}

export function Boton({ variante = "primario", className, ...props }: ComponentProps<"button"> & { variante?: keyof typeof estilosBoton }) {
  return <button className={clasesBoton(variante, className)} {...props} />;
}

export function EnlaceBoton({ variante = "primario", className, ...props }: ComponentProps<typeof Link> & { variante?: keyof typeof estilosBoton }) {
  return <Link className={clasesBoton(variante, className)} {...props} />;
}

const claseControl =
  "block w-full min-h-11 rounded-xl border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export function Campo({ etiqueta, ayuda, className, ...props }: ComponentProps<"input"> & { etiqueta: string; ayuda?: string }) {
  return (
    <label className={cx("block space-y-1", className)}>
      <span className="text-sm font-medium">{etiqueta}</span>
      <input className={claseControl} {...props} />
      {ayuda && <span className="block text-xs text-zinc-500">{ayuda}</span>}
    </label>
  );
}

export function Selector({ etiqueta, children, className, ...props }: ComponentProps<"select"> & { etiqueta: string }) {
  return (
    <label className={cx("block space-y-1", className)}>
      <span className="text-sm font-medium">{etiqueta}</span>
      <select className={claseControl} {...props}>
        {children}
      </select>
    </label>
  );
}

export function AreaTexto({ etiqueta, className, ...props }: ComponentProps<"textarea"> & { etiqueta: string }) {
  return (
    <label className={cx("block space-y-1", className)}>
      <span className="text-sm font-medium">{etiqueta}</span>
      <textarea className={cx(claseControl, "py-2")} rows={3} {...props} />
    </label>
  );
}

export function Casilla({ etiqueta, ...props }: ComponentProps<"input"> & { etiqueta: string }) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm">
      <input type="checkbox" className="size-5 accent-teal-700" {...props} />
      {etiqueta}
    </label>
  );
}

export function Tarjeta({ titulo, accion, children, className }: { titulo?: ReactNode; accion?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800", className)}>
      {(titulo || accion) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {titulo && <h2 className="font-semibold">{titulo}</h2>}
          {accion}
        </div>
      )}
      {children}
    </section>
  );
}

export function Aviso({ tipo = "error", children }: { tipo?: "error" | "ok" | "info"; children: ReactNode }) {
  const colores = {
    error: "bg-red-50 text-red-800 ring-red-200 dark:bg-red-950 dark:text-red-200 dark:ring-red-900",
    ok: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-900",
    info: "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950 dark:text-sky-200 dark:ring-sky-900",
  };
  return (
    <p role={tipo === "error" ? "alert" : "status"} className={cx("rounded-xl px-3 py-2 text-sm ring-1", colores[tipo])}>
      {children}
    </p>
  );
}

export function Titulo({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h1 className="text-xl font-bold">{children}</h1>
      {accion}
    </div>
  );
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return <p className="animate-pulse py-8 text-center text-sm text-zinc-500">{texto}</p>;
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-zinc-500">{children}</p>;
}
