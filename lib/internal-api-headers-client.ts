import { supabase } from "@/lib/supabase/client";
import { internalApiHeaders } from "@/lib/internal-api-headers";

/** Cabeçalhos para APIs CRM admin, incluindo auth_id do utilizador atual. */
export async function crmApiHeaders(): Promise<Record<string, string>> {
  const base = internalApiHeaders();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id) base["x-caller-auth-id"] = user.id;
  return base;
}
