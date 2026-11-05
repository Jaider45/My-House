import { Suspense } from "react";
import { Cargando, Tarjeta, Titulo } from "@/components/ui";
import { obtenerContexto } from "@/lib/sesion";
import { leerConfigHogar } from "@/lib/hogar";
import { MODELO_POR_DEFECTO, MODELOS_SUGERIDOS, NOMBRE_PROVEEDOR, proveedoresDisponibles, resolverIa } from "@/lib/ia/proveedores";
import { FormularioAsistente, FormularioHogar } from "./formulario";
import { PestanasConfiguracion } from "@/app/(app)/ajustes/pestanas";

export const metadata = { title: "Hogar" };

export default function Hogar() {
  return (
    <>
      <Titulo subtitulo="El hogar, quién entra, con qué cuentas y con qué valores">Configuración</Titulo>
      <PestanasConfiguracion actual="/ajustes/hogar" />
      <Suspense fallback={<Cargando compacto />}>
        <Contenido />
      </Suspense>
    </>
  );
}

async function Contenido() {
  const ctx = await obtenerContexto();
  const { data } = await ctx.supabase.from("households").select("ciudad, config").eq("id", ctx.hogar.id).single();
  const config = leerConfigHogar(data?.config);
  const disponibles = proveedoresDisponibles(process.env);
  const efectiva = resolverIa(config.ia, process.env);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Tarjeta titulo="Datos del hogar" subtitulo="Lo que el asistente sabe de ustedes sale de aquí y de las personas a cargo">
        <FormularioHogar
          nombre={ctx.hogar.nombre}
          ciudad={data?.ciudad ?? ""}
          cuota={config.cuota_imprevistos_pct}
          contexto={config.contexto}
          editable={ctx.esAdmin}
        />
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
  );
}
