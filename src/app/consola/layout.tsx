import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Consola", template: "%s · Consola My House" },
};

/** Consola del equipo de My House (roadmap SaaS). Acceso en (acceso), pantallas en (panel). */
export default function LayoutConsola({ children }: LayoutProps<"/consola">) {
  return children;
}
