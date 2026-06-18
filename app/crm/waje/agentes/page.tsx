import { redirect } from "next/navigation";

export default function WajeAgentesRedirect() {
  redirect("/crm/waje?tab=agentes");
}
