import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarAvatarUrlAgente } from "@/lib/crm/agente-avatar-gen";

export type ArtefatoBranding = {
  agenteNome: string;
  agenteSlug: string;
  cargo?: string;
  area?: string;
  avatarUrl: string;
  plataformaNome: string;
  geradoEm: string;
};

export async function carregarBrandingAgenteArtefato(
  supabase: SupabaseClient,
  tenantId: string,
  agenteSlug: string
): Promise<ArtefatoBranding> {
  const slug = agenteSlug.trim();
  const { data } = await supabase
    .from("hub_agente_identidade")
    .select("nome, cargo, area, avatar_url")
    .eq("tenant_id", tenantId)
    .eq("agente_slug", slug)
    .maybeSingle();

  const nome = String(data?.nome || slug).trim() || slug;
  const cargo = typeof data?.cargo === "string" ? data.cargo.trim() : undefined;
  const area = typeof data?.area === "string" ? data.area.trim() : undefined;
  const avatarRaw = typeof data?.avatar_url === "string" ? data.avatar_url : null;

  return {
    agenteNome: nome,
    agenteSlug: slug,
    cargo,
    area,
    avatarUrl: normalizarAvatarUrlAgente(slug, nome, avatarRaw),
    plataformaNome: "Synkron.IA",
    geradoEm: new Date().toLocaleString("pt-BR", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
  };
}
