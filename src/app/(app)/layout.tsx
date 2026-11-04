import { Navegacion } from "./navegacion";

export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-5 pb-28">{children}</main>
      <Navegacion />
    </>
  );
}
