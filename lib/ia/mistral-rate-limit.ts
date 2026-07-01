/** Detecção e mensagem para HTTP 429 / rate limit Mistral. */
export function isMistralRateLimitError(msg: string): boolean {
  const s = msg.toLowerCase();
  return (
    s.includes("429") ||
    s.includes("rate limit") ||
    s.includes("rate_limited") ||
    s.includes('"code":"1300"') ||
    s.includes("code\":1300")
  );
}

export function mensagemMistralRateLimitUsuario(contexto?: "audio" | "chat"): string {
  const extra =
    contexto === "audio"
      ? " A transcrição de áudio também usa a API Mistral — espere um pouco antes de gravar outra mensagem."
      : "";
  return `Limite de pedidos da IA (Mistral) atingido. Aguarde 30–60 segundos e tente novamente.${extra}`;
}

export function delayMsParaRetryMistral(status: number, attempt: number): number {
  if (status === 429) return Math.min(12_000, 1_500 * 2 ** attempt);
  return 450 * (attempt + 1);
}
