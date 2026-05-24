/** Token fixo — um único link público para todos os parceiros da rede. */
export const PARCEIRO_LINK_TOKEN_REDE = "rede";

export function urlCadastroParceiroPublico(origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/parceiro/cadastro/${PARCEIRO_LINK_TOKEN_REDE}`;
}

export function linkParceiroReutilizavel(metadata: Record<string, unknown> | null | undefined): boolean {
  if (!metadata) return false;
  if (metadata.reutilizavel === true) return true;
  return String(metadata.tipo_link || "") === "rede_publica";
}
