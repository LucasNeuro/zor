import { labelMercadoPrefixo, MERCADO_PREFIXO_PADRAO } from "@/lib/crm/negocio-cadastro";

/** Rótulo de mercado para agente Waje — sempre multi-setor (GRL). */
export function labelMercadoAgente(_prefixo_mercado?: string | null): string {
  return labelMercadoPrefixo(MERCADO_PREFIXO_PADRAO);
}
