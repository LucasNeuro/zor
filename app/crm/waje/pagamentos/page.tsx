import { redirect } from "next/navigation";

export default function WajePagamentosRedirect() {
  redirect("/crm/waje?tab=pagamentos");
}
