import { redirect } from "next/navigation";

/** Las guías paso a paso viven ahora en la Academia (sección «Guías paso a paso»). */
export default function Guias() {
  redirect("/academia?tema=guias");
}
