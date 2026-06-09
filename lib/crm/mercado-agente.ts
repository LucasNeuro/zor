import { MERCADO_PREFIXO_PADRAO } from "@/lib/crm/negocio-cadastro";

/** Valor gravado em hub_agente_identidade.prefixo_mercado a partir da seleção UI. */
export function prefixoMercadoParaGravacao(mercados: string[]): string {
  const limpos = mercados.map((m) => m.trim().toUpperCase()).filter(Boolean);
  if (limpos.length === 0) return MERCADO_PREFIXO_PADRAO;
  return limpos.join(",");
}

/** Parse prefixo_mercado do banco para chips na UI. */
export function mercadosFromPrefixoGravado(raw: string | null | undefined): string[] {
  const t = String(raw ?? "").trim();
  if (!t) return [];
  return t
    .split(",")
    .map((m) => m.trim().toUpperCase())
    .filter(Boolean)
    .filter((m) => m !== MERCADO_PREFIXO_PADRAO);
}
