import { Icono, Logo, type NombreIcono } from "@/components/marca";

type Props = {
  children: React.ReactNode;
  /** Mensaje del panel verde; por defecto, el de ingreso. */
  titulo?: string;
  texto?: string;
  puntos?: { icono: NombreIcono; texto: string }[];
};

/** Pantalla dividida del onboarding: panel de marca en verde monte (tablet en adelante) y el contenido a la derecha. */
export function MarcoMarca({
  children,
  titulo = "Cuánto cuesta sostener la casa, sin adivinar.",
  texto = "Ingresos, gastos y pagos fijos del hogar en un solo lugar, con el número mínimo del mes y la Renta DIAN al día.",
  puntos,
}: Props) {
  return (
    <div className="grid min-h-dvh flex-1 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="hidden flex-col justify-between gap-8 bg-monte p-10 text-arena md:flex lg:p-14">
        <Logo alto={40} negativo />
        <div className="space-y-4">
          <p className="text-[32px] leading-[38px] font-bold lg:text-[40px] lg:leading-[44px]">{titulo}</p>
          <p className="max-w-md text-[17px] leading-[26px] text-sobre-monte">{texto}</p>
        </div>
        {puntos ? (
          <ul className="flex flex-col gap-3 text-[15px]">
            {puntos.map((p) => (
              <li key={p.texto} className="flex items-center gap-2.5">
                <Icono nombre={p.icono} tamano={20} />
                {p.texto}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-sobre-monte">Hecho en Colombia · tus datos son solo de tu hogar</p>
        )}
      </aside>
      <main className="flex justify-center px-4 pt-5 pb-6 md:items-start md:px-12 md:py-[72px]">
        <div className="flex w-full max-w-[600px] flex-col gap-6">
          <div className="md:hidden">
            <Logo alto={30} />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
