import { redirect } from "next/navigation";

export default function NovoAgentePage() {
  redirect("/crm/agentes?novo=1");
}
