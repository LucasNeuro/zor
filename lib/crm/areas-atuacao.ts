/**
 * Áreas de atuação do cliente (PF/PJ) — fonte única para cadastro CRM.
 *
 * Consolidado de:
 * - hub_mercados / MERCADOS_FIXOS (IMB, ARQ, RFM, MRC, ENG, SRV, PRO, FOR)
 * - lib/ia/agentes-config.ts (MERCADOS — labels de mercado)
 * - tipos de lead (mercado_imobiliario, reforma, produto_servico, fornecedor_homologacao)
 * - cadastro de parceiros (especialidades em app/parceiro e app/crm/parceiros)
 * - categorias legadas de parceiros (arquitetura, engenharia, marcenaria, servicos, produtos)
 *
 * Não inclui áreas internas do escritório (CORES_AREA / hub_agente_identidade.area).
 */

export type AreaAtuacaoOption = {
  /** Valor gravado em hub_pessoas.area_atuacao */
  value: string;
  /** Rótulo exibido no formulário */
  label: string;
  /** Sigla hub_mercados quando aplicável */
  mercadoSigla?: string;
};

export const AREAS_ATUACAO: readonly AreaAtuacaoOption[] = [
  { value: "geral", label: "Geral / multi-setor", mercadoSigla: "GRL" },
  { value: "imobiliario", label: "Imobiliário", mercadoSigla: "IMB" },
  { value: "arquitetura", label: "Arquitetura", mercadoSigla: "ARQ" },
  { value: "reforma_obra", label: "Reforma e obra", mercadoSigla: "RFM" },
  { value: "marcenaria_moveis", label: "Marcenaria e móveis", mercadoSigla: "MRC" },
  { value: "engenharia_civil", label: "Engenharia civil", mercadoSigla: "ENG" },
  { value: "servicos", label: "Serviços", mercadoSigla: "SRV" },
  { value: "produtos_materiais", label: "Produtos e materiais", mercadoSigla: "PRO" },
  { value: "fornecedor_homologacao", label: "Fornecedor / homologação", mercadoSigla: "FOR" },
  { value: "construcao", label: "Construção" },
  { value: "advocacia", label: "Advocacia" },
  { value: "consultoria", label: "Consultoria" },
  { value: "outro", label: "Outro" },
] as const;

const BY_VALUE = new Map(AREAS_ATUACAO.map((a) => [a.value, a]));
const BY_LABEL = new Map(AREAS_ATUACAO.map((a) => [a.label.toLowerCase(), a]));

export function isAreaAtuacaoValid(value: string): boolean {
  const t = value.trim();
  if (!t) return false;
  return BY_VALUE.has(t) || BY_LABEL.has(t.toLowerCase());
}

/** Valor do select quando o cliente escolhe área personalizada. */
export const AREA_ATUACAO_OUTRO_VALUE = "outro";

export function labelAreaAtuacao(value: string): string {
  const t = value.trim();
  if (!t) return "—";
  const hit = BY_VALUE.get(t) ?? BY_LABEL.get(t.toLowerCase());
  return hit?.label ?? t;
}

/** Normaliza entrada (value ou label legado) para o value canónico. */
export function normalizarAreaAtuacao(value: string): string | null {
  const t = value.trim();
  if (!t) return null;
  const byVal = BY_VALUE.get(t);
  if (byVal) return byVal.value;
  const byLab = BY_LABEL.get(t.toLowerCase());
  if (byLab) return byLab.value;
  return null;
}

export const AREA_ATUACAO_SELECT_OPTIONS = AREAS_ATUACAO.map((a) => ({
  value: a.value,
  label: a.label,
}));
