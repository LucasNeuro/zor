import {
  FUNIL_PARA_LEGADO_ESTAGIO,
  LEGADO_ESTAGIO_PARA_FUNIL,
  type FunilLeadSlug,
} from "@/lib/crm/pipelines";
import { crmFeatureFlags } from "@/lib/crm/feature-flags";

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

/** Agrupa lead no kanban pela coluna ativa (slug do estágio na BD). */
export function estagioParaColunaKanban(estagio: string | null | undefined): string {
  const s = (estagio ?? "").trim();
  if (!s) return "novo";
  if (crmFeatureFlags.pipelineV2()) return s;
  return legacyToFunil(s) as string;
}
