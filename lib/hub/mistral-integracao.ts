import { mistralApiKey, mistralKeyFingerprint, pingMistralApi } from "@/lib/ia/mistral-health";

/** Mistral usa MISTRAL_API_KEY da plataforma — não há credencial por tenant na UI. */
export function mistralIntegracaoDisponivel(): boolean {
  return Boolean(mistralApiKey());
}

export async function mistralIntegracaoLigada(): Promise<boolean> {
  return mistralIntegracaoDisponivel();
}

/** Valida a chave Mistral (sideover «Ligar» / teste). */
export async function validarMistralPlataforma(): Promise<
  { ok: true; fingerprint: string } | { ok: false; error: string }
> {
  const ping = await pingMistralApi();
  if (!ping.ok) {
    return { ok: false, error: ping.detail || "Não foi possível validar a ligação com Mistral." };
  }
  return { ok: true, fingerprint: ping.fingerprint };
}

export function mistralIntegracaoFingerprint(): string {
  return mistralKeyFingerprint();
}
