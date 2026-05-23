import { redirect } from "next/navigation";

/** Legado: bookmarks antigos apontam para Analytics. */
export default function LegacyKpisRedirectPage() {
  redirect("/crm/analytics");
}
