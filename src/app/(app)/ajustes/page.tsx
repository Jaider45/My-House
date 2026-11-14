import { AccionPrincipal, Tarjeta, Titulo, cx } from "@/components/ui";
import { BotonGuia } from "@/components/guia/boton-guia";
import { OfertaEnLugar } from "@/components/ofertas-app";
import { obtenerContexto } from "@/lib/sesion";
import { leerConfigHogar } from "@/lib/hogar";
import { entornoIa } from "@/lib/ia";
import { MODELO_POR_DEFECTO, MODELOS_SUGERIDOS, NOMBRE_PROVEEDOR, proveedoresDisponibles, resolverIa } from "@/lib/ia/proveedores";
import { formatearCOP } from "@/lib/dinero";
import { formatearFecha } from "@/lib/fechas";
import { formatearTrm } from "@/lib/trm";
import { formatearMomento } from "@/lib/consola/formato";
import { FormularioTrm } from "./configuracion";
import { FormularioAsistente, FormularioHogar } from "./hogar/formulario";
import { PestanasConfiguracion } from "./pestanas";

export const metadata = { title: "Configuración" };

/**
 * Configuración → Hogar (primera pestaña). Cada grupo de ajustes vive en su pestaña del submenú superior
 * (Miembros, Personas a cargo, Categorías, Seguridad, Privacidad y datos, Plan); aquí solo lo del hogar.
 */
export default async function Configuracion() {
  const ctx = await obtenerContexto();
  const anio = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric" }).format(new Date()));
  const [{ data: hogar }, { data: uvts }, { data: trm }, entorno] = await Promise.all([
    ctx.supabase.from("households").select("nombre, ciudad, config").eq("id", ctx.hogar.id).single(),
    ctx.supabase.from("tax_params").select("anio, uvt_valor").eq("pais", ctx.hogar.pais).in("anio", [anio, anio + 1]).eq("publicado", true),
    ctx.supabase.from("trm").select("fecha, valor, creada").order("fecha", { ascending: false }).limit(1).maybeSingle(),
    entornoIa(),
  ]);
  const config = leerConfigHogar(hogar?.config);
  const uvt = (a: number) => uvts?.find((u) => u.anio === a)?.uvt_valor;
  // Solo nombres de proveedor y modelo llegan al formulario; las llaves se quedan en el servidor.
  const disponibles = proveedoresDisponibles(entorno);
  const efectiva = resolverIa(config.ia, entorno);

  return (
    <>
      <Titulo
        subtitulo="El hogar, quién entra, con qué cuentas y con qué valores"
        accion={
          <>
            <BotonGuia id="invitar" />
            {ctx.esAdmin && (
              <AccionPrincipal href="/ajustes/miembros?nuevo=1" guia="invitar-miembro">
                Invitar miembro
              </AccionPrincipal>
            )}
          </>
        }
      >
        Configuración
      </Titulo>
      <PestanasConfiguracion actual="/ajustes" />
      <OfertaEnLugar lugar="ajustes" />

      <div className="grid items-start gap-4 md:gap-5 lg:grid-cols-2">
        <Tarjeta titulo="Datos del hogar" subtitulo="Lo que el asistente sabe de ustedes sale de aquí y de las personas a cargo">
          <FormularioHogar nombre={hogar?.nombre ?? ctx.hogar.nombre} ciudad={hogar?.ciudad ?? ""} cuota={config.cuota_imprevistos_pct} contexto={config.contexto} editable={ctx.esAdmin} />
        </Tarjeta>

        <div className="flex flex-col gap-4 md:gap-5">
          <Tarjeta titulo="UVT y TRM" subtitulo="Los valores con que My House calcula topes y convierte pagos en dólares">
            <div className="grid gap-4 sm:grid-cols-2">
              <Dato etiqueta={`UVT ${anio}`} valor={uvt(anio) ? formatearCOP(uvt(anio)!) : "Sin publicar"} />
              <Dato etiqueta={`UVT ${anio + 1}`} valor={uvt(anio + 1) ? formatearCOP(uvt(anio + 1)!) : "Pendiente de publicación"} tenue={!uvt(anio + 1)} />
              <Dato
                etiqueta={config.trm.auto ? "TRM de hoy" : "TRM que usas"}
                valor={config.trm.auto ? (trm ? formatearTrm(Number(trm.valor)) : "Sin datos aún") : config.trm.manual ? formatearTrm(config.trm.manual) : "—"}
                detalle={config.trm.auto && trm ? `Vigente el ${formatearFecha(trm.fecha)} · actualizada ${formatearMomento(trm.creada)}` : config.trm.auto ? "Se actualiza cada mañana" : "Fija, la escribiste tú"}
              />
              <div>
                <FormularioTrm auto={config.trm.auto} manual={config.trm.manual} puede={ctx.esAdmin} />
              </div>
            </div>
            <p className="mt-4 text-[13px] text-tenue">
              La UVT la publica la DIAN cada año; los topes de Renta se calculan con ella. La TRM convierte los pagos que registras en dólares («¿Pagaste en dólares?» en Registrar).
            </p>
          </Tarjeta>

          <Tarjeta id="asistente" titulo="Asistente de IA" subtitulo="Con qué proveedor y modelo se leen comprobantes y extractos en PDF">
            <FormularioAsistente
              editable={ctx.esAdmin}
              disponibles={disponibles.map((p) => ({ valor: p, nombre: NOMBRE_PROVEEDOR[p], porDefecto: MODELO_POR_DEFECTO[p], sugeridos: MODELOS_SUGERIDOS[p] }))}
              proveedor={config.ia.proveedor ?? ""}
              modelo={config.ia.modelo ?? ""}
              efectiva={efectiva ? `${NOMBRE_PROVEEDOR[efectiva.proveedor]} · ${efectiva.modelo}` : null}
              elegidoSinLlave={config.ia.proveedor !== null && !disponibles.includes(config.ia.proveedor) ? NOMBRE_PROVEEDOR[config.ia.proveedor] : null}
            />
          </Tarjeta>
        </div>
      </div>
    </>
  );
}

function Dato({ etiqueta, valor, detalle, tenue }: { etiqueta: string; valor: string; detalle?: string; tenue?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-cuerpo">{etiqueta}</span>
      <span className={cx("flex h-11 items-center rounded-[10px] border border-control bg-mosaico/50 px-3 text-[15px]", tenue ? "text-tenue" : "font-semibold")}>{valor}</span>
      {detalle && <span className="text-[13px] text-tenue">{detalle}</span>}
    </div>
  );
}
