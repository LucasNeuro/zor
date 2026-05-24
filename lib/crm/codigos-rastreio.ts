import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Matriz de códigos do Hub (rastreio ponta a ponta).
 *
 * | Prefixo | Entidade        | Tabela           | Quando é gerado                          |
 * |---------|-----------------|------------------|------------------------------------------|
 * | PES     | Pessoa/contato  | hub_pessoas      | Cadastro PF/PJ, vínculo automático lead  |
 * | EMP     | Empresa (PJ)    | hub_empresas     | Super cadastro PJ                        |
 * | LED     | Lead comercial  | hub_leads_crm    | Pipeline vendas (WhatsApp, CRM, cadastro)|
 * | NEG     | Negócio         | hub_negocios     | Conversão lead → oportunidade            |
 * | PAR     | Parceiro rede   | hub_parceiros    | Formulário / convite parceiro            |
 * | IMO     | Imóvel          | hub_imoveis      | Cadastro de imóvel                       |
 *
 * Cadeia típica: PES → LED → NEG (parceiro: PAR; PJ também EMP).
 */
export const HUB_PREFIXO_CODIGO = {
  pessoa: "PES",
  empresa: "EMP",
  lead: "LED",
  negocio: "NEG",
  parceiro: "PAR",
  imovel: "IMO",
} as const;

export type HubPrefixoCodigo = (typeof HUB_PREFIXO_CODIGO)[keyof typeof HUB_PREFIXO_CODIGO];

/** Gera código sequencial PREFIXO-AAAA-#### (mesmo padrão em todo o hub). */
export async function gerarCodigoSequencial(
  supabase: SupabaseClient,
  tabela: string,
  prefixo: HubPrefixoCodigo
): Promise<string> {
  const year = new Date().getFullYear();
  const { count } = await supabase.from(tabela).select("*", { count: "exact", head: true });
  const seq = String((count || 0) + 1).padStart(4, "0");
  return `${prefixo}-${year}-${seq}`;
}
