import type { HarnessModeId } from "@/lib/harness/types";
import {
  grantPermiteEscritaCrm,
  modoBloqueiaEscritaCrm,
} from "@/lib/harness/stores/session-store";

export type HarnessWriteNivel = "escrita_crm" | "integracao" | "artefato";

export type HarnessToolPolicyInput = {
  toolName: string;
  argumentos?: Record<string, unknown>;
  modoId?: HarnessModeId;
  grants?: Record<string, boolean>;
  agenteInterno?: boolean;
};

export type HarnessToolPolicyResult =
  | { permitido: true }
  | {
      permitido: false;
      motivo: "modo_bloqueia_escrita" | "aprovacao_necessaria" | "ferramenta_nao_interna";
      nivel?: HarnessWriteNivel;
      resumo_humano?: string;
    };

function acaoCrmEscrita(args?: Record<string, unknown>): boolean {
  const acao = String(args?.acao ?? "").trim().toLowerCase();
  return acao === "criar" || acao === "atualizar" || acao === "create" || acao === "update";
}

function ehEscritaCrm(toolName: string, args?: Record<string, unknown>): boolean {
  if (toolName === "hub_operacao_empresa" || toolName.startsWith("hub_int_crm_ent_")) {
    return acaoCrmEscrita(args);
  }
  if (
    toolName === "hub_int_crm_atualizar_lead" ||
    toolName === "hub_atualizar_lead" ||
    toolName === "hub_criar_negocio" ||
    toolName === "hub_registar_nota_lead"
  ) {
    return true;
  }
  return false;
}

function ehEscritaArtefato(toolName: string): boolean {
  return toolName === "hub_superagente_artefato" || toolName === "hub_relatorio_html_simples";
}

function resumoHumanoEscrita(toolName: string, args?: Record<string, unknown>): string {
  const acao = String(args?.acao ?? "gravar").trim();
  const ent = toolName.replace(/^hub_int_crm_ent_/, "").replace(/^hub_/, "");
  return `Alteração CRM: ${ent} (${acao})`;
}

/**
 * Política de execução de tools no harness interno (RFC §9).
 * - conversar/analisar/planear: bloqueia escrita CRM
 * - operar: exige grant ou devolve aprovacao_necessaria
 */
export function avaliarPoliticaHarnessTool(
  input: HarnessToolPolicyInput
): HarnessToolPolicyResult {
  if (!input.agenteInterno) return { permitido: true };

  const modoId = input.modoId ?? "operar";
  const grants = input.grants ?? {};

  if (ehEscritaCrm(input.toolName, input.argumentos)) {
    if (modoBloqueiaEscritaCrm(modoId)) {
      return {
        permitido: false,
        motivo: "modo_bloqueia_escrita",
        nivel: "escrita_crm",
        resumo_humano: `Modo «${modoId}» não permite gravar no CRM. O harness ajusta o modo automaticamente em pedidos de escrita; confirme a aprovação na UI se necessário.`,
      };
    }
    if (!grantPermiteEscritaCrm(grants)) {
      return {
        permitido: false,
        motivo: "aprovacao_necessaria",
        nivel: "escrita_crm",
        resumo_humano: resumoHumanoEscrita(input.toolName, input.argumentos),
      };
    }
  }

  if (ehEscritaArtefato(input.toolName) && modoId === "conversar") {
    return {
      permitido: false,
      motivo: "modo_bloqueia_escrita",
      nivel: "artefato",
      resumo_humano: "Modo «conversar» não publica artefactos. Use «analisar» ou «operar».",
    };
  }

  return { permitido: true };
}

export function respostaJsonPoliticaHarness(
  policy: Extract<HarnessToolPolicyResult, { permitido: false }>,
  extra?: { approval_id?: string; tool_name?: string }
): string {
  return JSON.stringify({
    ok: false,
    harness_policy: true,
    motivo: policy.motivo,
    nivel: policy.nivel ?? null,
    resumo_humano: policy.resumo_humano ?? null,
    requer_modo: policy.motivo === "modo_bloqueia_escrita" ? "operar" : null,
    requer_aprovacao: policy.motivo === "aprovacao_necessaria",
    harness_suspended: policy.motivo === "aprovacao_necessaria",
    approval_id: extra?.approval_id ?? null,
    tool_name: extra?.tool_name ?? null,
  });
}
