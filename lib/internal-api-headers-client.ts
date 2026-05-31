import { supabase } from "@/lib/supabase/client";
import { internalApiHeaders } from "@/lib/internal-api-headers";

/** Cabeçalhos para APIs CRM admin, incluindo auth_id do utilizador atual. */
export async function crmApiHeaders(): Promise<Record<string, string>> {
  const base = internalApiHeaders();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id) base["x-caller-auth-id"] = user.id;
  return base;
}

/** Cabeçalhos CRM com identidade do utilizador para auditoria (exclusões, etc.). */
export async function crmApiHeadersWithActor(actor?: {
  id?: string | null;
  email?: string | null;
  name?: string | null;
}): Promise<Record<string, string>> {
  const h = await crmApiHeaders();
  if (actor?.id) h["x-user-id"] = actor.id;
  if (actor?.email) h["x-user-email"] = actor.email;
  if (actor?.name) h["x-user-name"] = actor.name;
  return h;
}
