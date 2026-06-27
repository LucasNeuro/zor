import { mem0Ping } from "@/lib/hub/mem0-api";
import { mem0PlataformaConfigurada, resolverMem0ApiKeyEnv } from "@/lib/hub/mem0-env";

/** Mem0 usa MEM0_API_KEY da plataforma — não há OAuth nem row em hub_integracoes. */
export function mem0IntegracaoDisponivel(): boolean {
  return mem0PlataformaConfigurada();
}

/** "Ligado" = chave presente no ambiente (web + worker). */
export async function mem0IntegracaoLigada(): Promise<boolean> {
  return mem0PlataformaConfigurada();
}

/** Valida a chave Mem0 (sideover «Ligar»). */
export async function validarMem0Plataforma(): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = resolverMem0ApiKeyEnv();
  if (!apiKey) {
    return { ok: false, error: "Super Memória não está configurada neste ambiente. Contacte o suporte da plataforma." };
  }
  const ping = await mem0Ping(apiKey);
  if (!ping.ok) {
    return { ok: false, error: ping.erro || "Não foi possível validar a ligação com Mem0." };
  }
  return { ok: true };
}
