import { normalizarAvatarUrlAgente } from "@/lib/crm/agente-avatar-gen";
import { resolveInferenceModelId } from "@/lib/ia/hub-model-defaults";

/** Resposta Hub ao cliente/browser — não expõe segredo da instância UAZAPI. */
export function sanitizarAgenteHubParaCliente(row: Record<string, unknown>): Record<string, unknown> {
  const { uazapi_instance_token: tok, ...rest } = row;
  const modeloPadrao = typeof rest.modelo_padrao === "string" ? rest.modelo_padrao : null;
  const slug = typeof rest.agente_slug === "string" ? rest.agente_slug.trim() : "";
  const nome = typeof rest.nome === "string" ? rest.nome : null;
  const avatarRaw = typeof rest.avatar_url === "string" ? rest.avatar_url : null;
  return {
    ...rest,
    avatar_url: slug ? normalizarAvatarUrlAgente(slug, nome, avatarRaw) : avatarRaw,
    uazapi_has_instance_token: typeof tok === "string" && tok.trim().length > 0,
    modelo_efetivo: resolveInferenceModelId(modeloPadrao),
  };
}
