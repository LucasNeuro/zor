import { redirect } from "next/navigation";

/** Escritório virtual desativado (opção A): entrada legada redireciona para o CRM. */
export default function OfficePage() {
  redirect("/crm");
}
