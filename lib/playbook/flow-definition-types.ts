import { PLAYBOOK_FLOW_SCHEMA_VERSION } from "./flow-schema";

/** @deprecated use PLAYBOOK_FLOW_SCHEMA_VERSION */
export const OBRA10_PLAYBOOK_FLOW_SCHEMA_VERSION = PLAYBOOK_FLOW_SCHEMA_VERSION;

export type Obra10PlaybookFlowSchemaVersion = typeof PLAYBOOK_FLOW_SCHEMA_VERSION;

/** Jornadas genéricas (Waje) + legado construção (leitura). */
export type PlaybookFlowJourney =
  | "triagem"
  | "vendas"
  | "suporte"
  | "onboarding"
  | "arquitetura"
  | "imobiliario";

export type PlaybookFlowStepKind = "message" | "menu" | "input" | "complete" | "media";

/** Tipos de mídia UAZAPI (/send/media) suportados nos blocos de fluxo. */
export type PlaybookFlowMediaType = "image" | "document" | "video";

/** Tipos de transferência (metadata + editor visual). */
export type PlaybookFlowTransferKind =
  | "humano"
  | "agente"
  | "whatsapp_card"
  | "email";

export type PlaybookFlowInputType = "text" | "email" | "phone" | "number";

export type PlaybookFlowHandoffTarget =
  | "time_humano"
  | "vendas"
  | "suporte"
  | "parcerias"
  | "arquitetura"
  | "imobiliario";

export type PlaybookFlowPotential = "ALTO" | "MEDIO" | "BAIXO";

export type PlaybookFlowLeadKind =
  | "cliente_projetos"
  | "cliente_imobiliario"
  | "imobiliaria_corretor"
  | "outro";

export type PlaybookFlowCrmPatch = {
  estagio?: string;
  potencial?: PlaybookFlowPotential;
  lead_kind?: PlaybookFlowLeadKind;
  fluxo_ativo?: string;
  intencao_imobiliario?: string;
  interesse_principal?: string;
  tags_add?: string[];
  metadata?: Record<string, unknown>;
};

export type PlaybookFlowCompleteAction = {
  type: "complete";
  handoff_to?: PlaybookFlowHandoffTarget;
  summary?: string;
  crm_patch?: PlaybookFlowCrmPatch;
};

export type PlaybookFlowMenuOption = {
  id: string;
  label: string;
  next?: string;
  crm_patch?: PlaybookFlowCrmPatch;
  complete?: PlaybookFlowCompleteAction;
};

export type PlaybookFlowBaseStep = {
  id: string;
  kind: PlaybookFlowStepKind;
  title?: string;
  journey?: PlaybookFlowJourney;
  crm_patch?: PlaybookFlowCrmPatch;
};

export type PlaybookFlowMessageStep = PlaybookFlowBaseStep & {
  kind: "message";
  message: string;
  next?: string;
  complete?: PlaybookFlowCompleteAction;
};

export type PlaybookFlowMenuStep = PlaybookFlowBaseStep & {
  kind: "menu";
  prompt: string;
  /** Chave em wa_playbook_answers; padrão: id do step. */
  field?: string;
  /** Força botões (≤3) ou lista UAZAPI; se omitido, escolhe por quantidade de opções. */
  menu_type?: "button" | "list";
  /** Texto do botão que abre a lista (UAZAPI listButton). */
  list_button?: string;
  options: PlaybookFlowMenuOption[];
  on_select?: Record<string, string>;
};

export type PlaybookFlowMediaStep = PlaybookFlowBaseStep & {
  kind: "media";
  media_type: PlaybookFlowMediaType;
  /** URL pública https ou link Supabase storage. */
  file: string;
  caption?: string;
  next?: string;
};

export type PlaybookFlowInputStep = PlaybookFlowBaseStep & {
  kind: "input";
  prompt: string;
  field: string;
  input_type?: PlaybookFlowInputType;
  next?: string;
  complete?: PlaybookFlowCompleteAction;
};

export type PlaybookFlowCompleteStep = PlaybookFlowBaseStep & {
  kind: "complete";
  complete: PlaybookFlowCompleteAction;
  /** Opcional: passo após ação de conclusão/transferência (ex.: mensagem de confirmação). */
  next?: string;
};

export type PlaybookFlowStep =
  | PlaybookFlowMessageStep
  | PlaybookFlowMenuStep
  | PlaybookFlowInputStep
  | PlaybookFlowCompleteStep
  | PlaybookFlowMediaStep;

export type PlaybookFlowDefinition = {
  /** Chave canónica Waje (escrita em playbooks novos). */
  waje_playbook_flow_schema?: typeof PLAYBOOK_FLOW_SCHEMA_VERSION;
  /** Chave legada Obra10 (leitura). */
  obra10_playbook_flow_schema?: Obra10PlaybookFlowSchemaVersion;
  id?: string;
  version?: string;
  entry_step_id: string;
  journeys?: PlaybookFlowJourney[];
  steps: PlaybookFlowStep[];
};
