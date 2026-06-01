import {
  type AgenteInstrucaoIdent,
  isPlaybookOnlyAgent,
  temReferenciaPlaybookPublicado,
} from "@/lib/hub/agente-instrucao-modo";

export type AgentePlaybookRoutingContext = {
  ident: AgenteInstrucaoIdent;
  playbookActive: boolean;
  playbookComplete: boolean;
};

export type AgentePlaybookRouting = {
  temPlaybookPublicado: boolean;
  playbookOnly: boolean;
  cargoComPlaybook: boolean;
  /** Fluxo JSON publicado deve ser a única fonte no WhatsApp (nunca hardcoded legado). */
  proibirFallbackLegado: boolean;
  /** Não chamar IA generativa neste turno. */
  bloquearIa: boolean;
  /** Motivo operacional para logs. */
  motivo?: string;
};

export function resolverRoteamentoPlaybookAgente(ctx: AgentePlaybookRoutingContext): AgentePlaybookRouting {
  const temPlaybookPublicado = temReferenciaPlaybookPublicado(ctx.ident);
  const playbookOnly = isPlaybookOnlyAgent(ctx.ident);
  const cargoComPlaybook = temPlaybookPublicado && !playbookOnly;

  if (!temPlaybookPublicado) {
    return {
      temPlaybookPublicado: false,
      playbookOnly: false,
      cargoComPlaybook: false,
      proibirFallbackLegado: false,
      bloquearIa: false,
    };
  }

  if (playbookOnly) {
    return {
      temPlaybookPublicado: true,
      playbookOnly: true,
      cargoComPlaybook: false,
      proibirFallbackLegado: true,
      bloquearIa: true,
      motivo: "playbook_only",
    };
  }

  if (ctx.playbookActive && !ctx.playbookComplete) {
    return {
      temPlaybookPublicado: true,
      playbookOnly: false,
      cargoComPlaybook: true,
      proibirFallbackLegado: true,
      bloquearIa: true,
      motivo: "cargo_com_playbook_fluxo_ativo",
    };
  }

  if (!ctx.playbookComplete) {
    return {
      temPlaybookPublicado: true,
      playbookOnly: false,
      cargoComPlaybook: true,
      proibirFallbackLegado: true,
      bloquearIa: true,
      motivo: "cargo_com_playbook_aguardando_fluxo",
    };
  }

  return {
    temPlaybookPublicado: true,
    playbookOnly: false,
    cargoComPlaybook: true,
    proibirFallbackLegado: true,
    bloquearIa: false,
    motivo: "cargo_com_playbook_pos_fluxo",
  };
}

export const MSG_PLAYBOOK_FLUXO_INDISPONIVEL =
  "No momento não consegui iniciar o roteiro de atendimento. Nossa equipe já foi avisada e retorna por aqui em breve.";

export const MSG_PLAYBOOK_POS_CONCLUSAO =
  "Seu pré-atendimento já foi registrado. Nossa equipe analisa as informações e retorna por aqui em breve.";

export type HubAgenteIdentidadePlaybookRow = AgenteInstrucaoIdent & {
  agente_slug?: string | null;
  uazapi_instance_token?: string | null;
};

export const AGENTE_IDENTIDADE_PLAYBOOK_SELECT =
  "agente_slug, cargo, area, instrucao_modo, playbook_object_path, playbook_public_url, playbook_generated_at, playbook_source_hash, uazapi_instance_token";
