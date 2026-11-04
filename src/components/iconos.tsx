import type { SVGProps } from "react";

function Base(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="size-6"
      {...props}
    />
  );
}

export const IconoInicio = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </Base>
);
export const IconoLista = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </Base>
);
export const IconoMas = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);
export const IconoImpuestos = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M9 14 15 8M9.5 8.5h.01M14.5 13.5h.01M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" />
  </Base>
);
export const IconoAjustes = (p: SVGProps<SVGSVGElement>) => (
  <Base {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Base>
);
