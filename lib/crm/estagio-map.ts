import {
  FUNIL_PARA_LEGADO_ESTAGIO,
  LEGADO_ESTAGIO_PARA_FUNIL,
  type FunilLeadSlug,
} from "@/lib/crm/pipelines";
import { crmFeatureFlags } from "@/lib/crm/feature-flags";

/** Sinónimos entre slugs PDF, legado e pipelines customizados do tenant. */
const COLUNA_KANBAN_SINONIMOS: Record<string, string[]> = {
  qualificando: ["qualificado", "qualificando"],
  qualificado: ["qualificado", "qualificando"],
  convertido_negocio: ["ganho", "convertido_negocio"],
  ganho: ["ganho", "convertido_negocio"],
  encaminhado: ["qualificado", "proposta", "encaminhado"],
  aguardando_resposta: ["em_atendimento", "aguardando", "aguardando_resposta"],
  em_atendimento: ["em_atendimento", "negociando", "em_andamento"],
  negociando: ["negociando", "em_atendimento"],
  proposta: ["proposta", "qualificado", "encaminhado"],
  fechamento: ["fechamento", "qualificado", "negociando"],
  spam_invalido: ["perdido", "spam_invalido"],
  perdido: ["perdido", "spam_invalido"],
};

export type LeadEstagioFonte = {
  estagio?: string | null;
  estagio_funil?: string | null;
};

/** Slug canônico do funil PDF para exibição/agrupamento. */
export function legacyToFunil(estagio: string | null | undefined): FunilLeadSlug | string {
  const s = (estagio ?? "").trim();
  if (!s) return "novo";
  if (s in LEGADO_ESTAGIO_PARA_FUNIL) return LEGADO_ESTAGIO_PARA_FUNIL[s];
  if (Object.prototype.hasOwnProperty.call(FUNIL_PARA_LEGADO_ESTAGIO, s)) return s as FunilLeadSlug;
  return s;
}

/** Grava em `estagio` (legado) a partir do slug PDF. */
export function funilToLegacy(funil: string | null | undefined): string {
  const s = (funil ?? "").trim() as FunilLeadSlug;
  return FUNIL_PARA_LEGADO_ESTAGIO[s] ?? funil ?? "novo";
}

export type LeadEstagioPatch = {
  estagio?: string;
  estagio_funil?: string;
};

/** Monta patch de estágio para hub_leads_crm conforme feature flag. */
export function buildLeadEstagioPatch(novoFunilOuLegado: string): LeadEstagioPatch {
  const funil = legacyToFunil(novoFunilOuLegado) as string;
  if (crmFeatureFlags.pipelineV2()) {
    return {
      estagio_funil: funil,
      estagio: funil,
    };
  }
  return {
    estagio: funilToLegacy(funil),
    estagio_funil: funil,
  };
}

/** Preferência: `estagio_funil` (PDF) e depois `estagio` (legado). */
export function estagioBrutoLead(lead: LeadEstagioFonte): string {
  return (lead.estagio_funil ?? lead.estagio ?? "").trim();
}

function normalizarSlugKanban(raw: string): string {
  if (!raw) return "novo";
  return legacyToFunil(raw) as string;
}

function encaixarEmColunas(slug: string, colunasIds: readonly string[]): string {
  if (!colunasIds.length) return slug;
  if (colunasIds.includes(slug)) return slug;

  const candidatos = [slug, ...(COLUNA_KANBAN_SINONIMOS[slug] ?? [])];
  for (const c of candidatos) {
    if (colunasIds.includes(c)) return c;
  }

  return colunasIds.includes("novo") ? "novo" : colunasIds[0]!;
}

/**
 * Agrupa lead no kanban pela coluna ativa.
 * Aceita string (legado) ou lead com `estagio_funil` + `estagio`.
 * Com `colunasIds`, encaixa slugs órfãos (ex.: qualificando → qualificado).
 */
export function estagioParaColunaKanban(
  estagioOuLead: string | LeadEstagioFonte | null | undefined,
  colunasIds?: readonly string[]
): string {
  let raw = "";
  if (estagioOuLead != null && typeof estagioOuLead === "object") {
    raw = estagioBrutoLead(estagioOuLead);
  } else {
    raw = (estagioOuLead ?? "").trim();
  }

  const slug = normalizarSlugKanban(raw);
  return colunasIds?.length ? encaixarEmColunas(slug, colunasIds) : slug;
}
