import { redirect } from "next/navigation";

export default function CrmHomeRedirect() {
  redirect("/crm/painel?tab=visao-geral&view=paineis");
}
