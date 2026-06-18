import { redirect } from "next/navigation";

export default function WajeTenantsRedirect() {
  redirect("/crm/waje?tab=tenants");
}
