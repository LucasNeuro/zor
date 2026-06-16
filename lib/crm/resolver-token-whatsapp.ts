import type { SupabaseClient } from "@supabase/supabase-js";
import { resolverLinhaWhatsAppInbound } from "@/lib/whatsapp/resolver-linha-whatsapp";

/** Resolve token UAZAPI do agente WhatsApp ligado ao lead (ou fallback global). */
export async function resolverTokenInstanciaWhatsapp(
  supabase: SupabaseClient,
  agenteSlug: string | null | undefined
): Promise<{ token: string | null; origem: string }> {
  const slug = typeof agenteSlug === "string" ? agenteSlug.trim() : "";
  if (slug) {
    const { data: agenteRow, error } = await supabase
      .from("hub_agente_identidade")
      .select("uazapi_instance_token, uazapi_connection_status, ativo, arquivado_em")
      .eq("agente_slug", slug)
      .maybeSingle();

    if (error) {
      console.warn("[CRM][WA] token por agente:", error.message);
    } else {
      const token =
        typeof agenteRow?.uazapi_instance_token === "string"
          ? agenteRow.uazapi_instance_token.trim()
          : "";
      const status =
        typeof agenteRow?.uazapi_connection_status === "string"
          ? agenteRow.uazapi_connection_status.trim()
          : "";
      const agenteOk =
        token &&
        agenteRow?.ativo !== false &&
        agenteRow?.arquivado_em == null &&
        (status === "connected" || status === "");
      if (agenteOk) {
        return { token, origem: `agente:${slug}` };
      }
      if (token && status && status !== "connected") {
        console.warn(`[CRM][WA] agente ${slug} com WhatsApp ${status}; tentando fallback`);
      }
    }
  }

  const linha = await resolverLinhaWhatsAppInbound(supabase, null, {});
  if (linha.kind === "agent_instance") {
    return { token: linha.instanceToken, origem: `linha:${linha.agenteSlug}` };
  }
  if (linha.kind === "legacy_global_token") {
    const legacy = process.env.UAZAPI_INSTANCE_TOKEN?.trim() || null;
    return { token: legacy, origem: "legacy_global_token" };
  }

  return { token: null, origem: linha.kind === "ignored" ? linha.reason : "desconhecido" };
}
