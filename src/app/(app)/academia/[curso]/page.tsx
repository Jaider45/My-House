import { notFound, redirect } from "next/navigation";
import { obtenerUsuario } from "@/lib/sesion";
import { avanceCurso, cursoPorSlug, leerVistasAcademia } from "@/lib/academia";

/** Un curso abre en la lección que sigue (o en la primera si ya lo terminaste). */
export default async function Curso({ params }: PageProps<"/academia/[curso]">) {
  const { curso: slug } = await params;
  const curso = cursoPorSlug(slug);
  if (!curso) notFound();
  const { user } = await obtenerUsuario();
  const a = avanceCurso(curso, new Set(leerVistasAcademia(user.user_metadata)));
  redirect(`/academia/${curso.slug}/${(a.siguiente ?? curso.lecciones[0]).slug}`);
}
