import type { HubAgenteFerramentaId } from "@/lib/hub/agente-ferramentas-registry";
import {
  CRM_ENTIDADES_TOOL_KEYS,
  HUB_INT_CRM_ENT_PREFIX,
  crmEntidadeToolKey,
  isCrmEntidadeToolKey,
  parseCrmEntidadeToolKey,
} from "@/lib/hub/crm-integrador-entidades-shared";

export {
  CRM_ENTIDADES_TOOL_KEYS,
  HUB_INT_CRM_ENT_PREFIX,
  crmEntidadeToolKey,
  isCrmEntidadeToolKey,
  parseCrmEntidadeToolKey,
};

/** Integrador nativo da plataforma — CRM Supabase do tenant (sem OAuth). */
export const WAJE_CRM_INTEGRADOR_ID = "waje_crm" as const;

export const HUB_INT_CRM_CONSULTAR = "hub_int_crm_consultar";
export const HUB_INT_CRM_OPERAR = "hub_int_crm_operar";
export const HUB_INT_CRM_ATUALIZAR_LEAD = "hub_int_crm_atualizar_lead";
export const HUB_INT_CRM_REGISTAR_NOTA = "hub_int_crm_registar_nota";
export const HUB_INT_CRM_CRIAR_NEGOCIO = "hub_int_crm_criar_negocio";

/** Atalhos de canal WhatsApp/e-mail (não duplicar em agentes internos). */
export const HUB_INT_CRM_ATALHOS_CANAL = [
  HUB_INT_CRM_ATUALIZAR_LEAD,
  HUB_INT_CRM_REGISTAR_NOTA,
  HUB_INT_CRM_CRIAR_NEGOCIO,
] as const;

export const HUB_INT_CRM_KEYS = [
  HUB_INT_CRM_CONSULTAR,
  HUB_INT_CRM_OPERAR,
  ...HUB_INT_CRM_ATALHOS_CANAL,
  ...CRM_ENTIDADES_TOOL_KEYS,
] as const;

/** Ferramentas «Base de dados CRM (Supabase)» visíveis no funcionário IA (copiloto / jobs_internos). */
export const CHAVES_FERRAMENTAS_BANCO_CRM_WAJE_INTERNO = [
  HUB_INT_CRM_CONSULTAR,
  ...CRM_ENTIDADES_TOOL_KEYS,
] as const;

/** Mesmo bloco + atalhos de canal WhatsApp/e-mail. */
export const CHAVES_FERRAMENTAS_BANCO_CRM_WAJE_CANAL = [
  HUB_INT_CRM_CONSULTAR,
  ...CRM_ENTIDADES_TOOL_KEYS,
  ...HUB_INT_CRM_ATALHOS_CANAL,
] as const;

export function chavesFerramentasBancoCrmWaje(modoInterno: boolean): readonly string[] {
  return modoInterno ? CHAVES_FERRAMENTAS_BANCO_CRM_WAJE_INTERNO : CHAVES_FERRAMENTAS_BANCO_CRM_WAJE_CANAL;
}

export type HubIntCrmKey = (typeof HUB_INT_CRM_KEYS)[number];

/** Ferramentas builtin que passam a aparecer na secção Integrações (Supabase). */
export const FERRAMENTAS_CRM_MOVED_TO_INTEGRADOR: readonly HubAgenteFerramentaId[] = [
  "hub_operacao_empresa",
  "hub_dados_empresa",
  "hub_superagente_dados",
  "hub_atualizar_lead",
  "hub_registar_nota_lead",
  "hub_criar_negocio",
];

export const CRM_INTEGRADOR_BUILTIN_MAP: Record<
  | typeof HUB_INT_CRM_CONSULTAR
  | typeof HUB_INT_CRM_OPERAR
  | typeof HUB_INT_CRM_ATUALIZAR_LEAD
  | typeof HUB_INT_CRM_REGISTAR_NOTA
  | typeof HUB_INT_CRM_CRIAR_NEGOCIO,
  HubAgenteFerramentaId
> = {
  [HUB_INT_CRM_CONSULTAR]: "hub_superagente_dados",
  [HUB_INT_CRM_OPERAR]: "hub_operacao_empresa",
  [HUB_INT_CRM_ATUALIZAR_LEAD]: "hub_atualizar_lead",
  [HUB_INT_CRM_REGISTAR_NOTA]: "hub_registar_nota_lead",
  [HUB_INT_CRM_CRIAR_NEGOCIO]: "hub_criar_negocio",
};

/** Sincroniza chaves legadas ↔ integrador Supabase para agentes já gravados. */
export function sincronizarUsoCrmIntegrador(uso: Record<string, boolean>): Record<string, boolean> {
  const m = { ...uso };

  if (m.hub_operacao_empresa === true) {
    m[HUB_INT_CRM_OPERAR] = true;
    for (const key of CRM_ENTIDADES_TOOL_KEYS) m[key] = true;
  }
  if (m.hub_dados_empresa === true || m.hub_superagente_dados === true) {
    m[HUB_INT_CRM_CONSULTAR] = true;
  }
  if (m.hub_atualizar_lead === true) m[HUB_INT_CRM_ATUALIZAR_LEAD] = true;
  if (m.hub_registar_nota_lead === true) m[HUB_INT_CRM_REGISTAR_NOTA] = true;
  if (m.hub_criar_negocio === true) m[HUB_INT_CRM_CRIAR_NEGOCIO] = true;

  return m;
}
