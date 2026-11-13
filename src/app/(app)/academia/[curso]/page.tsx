import { notFound, redirect } from "next/navigation";
import { obtenerUsuario } from "@/lib/sesion";
import { avanceCurso, cursoPorSlug, leerVistasAcademia } from "@/lib/academia";
import { cargarCursos } from "@/lib/academia/servidor";

/** Un curso abre en la lección que sigue (o en la primera si ya lo terminaste). */
export default async function Curso({ params }: PageProps<"/academia/[curso]">) {
  const { curso: slug } = await params;
  const { user, supabase } = await obtenerUsuario();
  const cursos = await cargarCursos(supabase);
  const curso = cursoPorSlug(cursos, slug);
  if (!curso) notFound();
  const a = avanceCurso(curso, new Set(leerVistasAcademia(user.user_metadata, cursos)));
  redirect(`/academia/${curso.slug}/${(a.siguiente ?? curso.lecciones[0]).slug}`);
}
