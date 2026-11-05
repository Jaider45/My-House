import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";
import { RegistrarServiceWorker } from "@/components/registrar-sw";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "My House", template: "%s · My House" },
  description: "Finanzas del hogar: gastos, costo de vida y renta en orden.",
  applicationName: "My House",
  appleWebApp: { capable: true, title: "My House", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#143d33",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CO" className={`${figtree.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
