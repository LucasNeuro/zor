/**
 * Runtime WhatsApp do playbook publicado (fluxo dinâmico + fallback legado Mari).
 * Estado em hub_leads_crm.metadata: wa_playbook_step, wa_playbook_answers, wa_playbook_active.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { persistirMensagemSaidaIaCrm } from "@/lib/crm/backfill-mensagens-ia-crm";
import { buildHubLeadsCrmPatch } from "@/lib/hub/hub-leads-crm-atualizar";
import {
  enviarMenuUazapi,
  marcarMenuTriagemEnviado,
  mensagemEhSaudacaoSimples,
  mensagemPedeMenuOuOpcoes,
} from "@/lib/whatsapp/menu-triagem-uazapi";
import { deveAnexarMenuTriagemAutomatico } from "@/lib/whatsapp/menu-triagem-policy";
import { whatsappSendText, whatsappSendMedia } from "@/lib/whatsapp/whatsapp-send";
import {
  executeFlowEngine,
  type FlowEngineDefinition,
  type FlowEngineStep,
} from "@/lib/playbook/flow-engine";
import type { PlaybookFlowDefinition, PlaybookFlowStep } from "@/lib/playbook/flow-definition-types";
import {
  executarAcaoTransferenciaFluxo,
  extrairTransferDoPassoComplete,
} from "@/lib/playbook/flow-transfer-actions";
import { parsePlaybookFlowFromMarkdown } from "@/lib/playbook/flow-parse";
import { aplicarFluxoEmpresaAoMarkdown } from "@/lib/playbook/playbook-flow-from-context";
import { ensureMarkdownWithWhatsappFlow } from "@/lib/playbook/playbook-flow-template";
import { validatePlaybookFlowDefinition } from "@/lib/playbook/flow-validate";
import { loadPublishedPlaybookRuntimeSource } from "@/lib/playbook/published-runtime";
import {
  avancarEstadoFluxoPlaybookWhatsapp,
  buildBlocoContextoFluxoParaLlm,
  simFlowStateFromPlaybookLead,
} from "@/lib/playbook/simulacao-canal-flow";
import {
  AGENTE_IDENTIDADE_PLAYBOOK_SELECT,
  MSG_PLAYBOOK_FLUXO_INDISPONIVEL,
  MSG_PLAYBOOK_POS_CONCLUSAO,
  resolverRoteamentoPlaybookAgente,
  type HubAgenteIdentidadePlaybookRow,
} from "@/lib/hub/agente-playbook-routing";
import {
  lerEmpresaCadastralTenant,
  nomeComercialEmpresa,
} from "@/lib/hub/tenant-empresa-cadastral";
import { defaultTenantId } from "@/lib/tenant-default";
import { menuFooterEmpresa } from "@/lib/whatsapp/menu-footer";
import { mensagemJaIndicaIntentTriagem } from "@/lib/whatsapp/menu-intent";
import { temReferenciaPlaybookPublicado } from "@/lib/hub/agente-instrucao-modo";

export type PlaybookStep =
  | "aguardar_nome"
  | "triagem_inicial"
  | "arq_tipo_imovel"
  | "arq_tamanho"
  | "arq_localizacao"
  | "arq_prazo"
  | "imob_sub"
  | "prop_intencao"
  | "prop_localizacao"
  | "prop_tamanho"
  | "prop_valor"
  | "prop_midias"
  | "parc_email"
  | "parc_tipo"
  | "parc_imovel_localizacao"
  | "parc_imovel_tamanho"
  | "parc_imovel_valor"
  | "parc_imovel_midias"
  | "outro_descricao"
  | "concluido";

const HARDCODED_STEPS = new Set<PlaybookStep>([
  "aguardar_nome",
  "triagem_inicial",
  "arq_tipo_imovel",
  "arq_tamanho",
  "arq_localizacao",
  "arq_prazo",
  "imob_sub",
  "prop_intencao",
  "prop_localizacao",
  "prop_tamanho",
  "prop_valor",
  "prop_midias",
  "parc_email",
  "parc_tipo",
  "parc_imovel_localizacao",
  "parc_imovel_tamanho",
  "parc_imovel_valor",
  "parc_imovel_midias",
  "outro_descricao",
  "concluido",
]);

function isHardcodedStep(step: string): step is PlaybookStep {
  return HARDCODED_STEPS.has(step as PlaybookStep);
}

export type PlaybookProcessResult =
  | { handled: false; bloquearIa?: boolean; motivo?: string }
  | {
      handled: true;
      skipIa: boolean;
      step?: PlaybookStep;
      bloquearIa?: boolean;
      motivo?: string;
      /** Bloco de contexto do roteiro para injetar no prompt da IA. */
      flowContext?: string;
      motor?: "playbook_ia" | "playbook_flow";
      pendingMenu?: import("@/lib/playbook/flow-engine").FlowPendingMenu;
    };

type PlaybookAnswers = Record<string, string>;

async function rodapeMenuTenant(supabase: SupabaseClient, agenteSlug: string): Promise<string> {
  const { data: row } = await supabase
    .from("hub_agente_identidade")
    .select("tenant_id")
    .eq("agente_slug", agenteSlug.trim())
    .maybeSingle();
  const tenantId =
    (typeof row?.tenant_id === "string" && row.tenant_id.trim()) || defaultTenantId();
  const { cadastral, nome_exibicao } = await lerEmpresaCadastralTenant(supabase, tenantId);
  return menuFooterEmpresa(nomeComercialEmpresa(cadastral, nome_exibicao));
}

const KNOWN_CHOICE_IDS = new Set([
  "triagem_arq",
  "triagem_imob",
  "triagem_homolog",
  "triagem_prop_anunciar",
  "triagem_outro",
  "arq_tipo_ap",
  "arq_tipo_casa",
  "arq_tipo_com",
  "arq_tipo_ind",
  "arq_tipo_outro",
  "arq_m2_ate50",
  "arq_m2_51_250",
  "arq_m2_251_500",
  "arq_m2_mais500",
  "arq_m2_ns",
  "arq_prazo_imediato",
  "arq_prazo_30",
  "arq_prazo_60",
  "arq_prazo_90",
  "arq_prazo_mais",
  "imob_comprar",
  "imob_vender",
  "imob_alugar",
  "imob_anunciar",
  "imob_outro",
  "prop_vender",
  "prop_alugar",
  "parc_cadastro",
  "parc_parceria",
  "fluxo1",
  "fluxo2",
  "fluxo3",
  "fluxo_arquitetura",
  "fluxo_imobiliario",
  "fluxo_parceiro",
  "vender",
  "alugar",
  "cadastro_imovel",
  "parceria",
]);

function normAlias(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const CHOICE_ALIASES = new Map<string, string>();
function regAlias(label: string, id: string) {
  CHOICE_ALIASES.set(normAlias(label), id);
  CHOICE_ALIASES.set(normAlias(id), id);
}

function parseBoolEnvOnByDefault(value: string | undefined): boolean {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return true;
  return !(raw === "0" || raw === "false" || raw === "off");
}

function dynamicFlowEnabled(): boolean {
  return parseBoolEnvOnByDefault(process.env.PLAYBOOK_DYNAMIC_FLOW);
}

function playbookHybridIaEnabled(): boolean {
  const raw = String(process.env.PLAYBOOK_HYBRID_IA ?? "1").trim().toLowerCase();
  return !(raw === "0" || raw === "false" || raw === "off");
}

export function playbookMenuUazapiEnhancementEnabled(): boolean {
  const raw = String(process.env.PLAYBOOK_MENU_UAZAPI_ENHANCE ?? "1").trim().toLowerCase();
  return !(raw === "0" || raw === "false" || raw === "off");
}

function normalizeDynamicId(raw: string, fallback: string): string {
  const cleaned = raw.trim();
  if (!cleaned) return fallback;
  return cleaned
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function makeSyntheticCompleteStepId(stepId: string, suffix: string): string {
  return `${normalizeDynamicId(stepId, "step")}__complete__${normalizeDynamicId(suffix, "done")}`;
}

function textFromCompleteAction(
  step: PlaybookFlowStep & { complete?: { summary?: string } },
  fallback: string
): string {
  const summary =
    step.complete && typeof step.complete.summary === "string"
      ? step.complete.summary.trim()
      : "";
  if (summary) return summary;
  if (typeof step.title === "string" && step.title.trim()) return step.title.trim();
  return fallback;
}

export function convertStructuredFlowToEngine(definition: PlaybookFlowDefinition): FlowEngineDefinition {
  const steps: Record<string, FlowEngineStep> = {};
  const syntheticCompleteSteps: Record<string, FlowEngineStep> = {};

  for (const step of definition.steps) {
    const stepId = step.id.trim();

    if (step.kind === "message") {
      let nextStep = typeof step.next === "string" && step.next.trim() ? step.next.trim() : undefined;
      if (!nextStep && step.complete) {
        nextStep = makeSyntheticCompleteStepId(stepId, "message");
        syntheticCompleteSteps[nextStep] = {
          id: nextStep,
          type: "complete",
          text: textFromCompleteAction(step, "Concluí essa etapa. Nosso time seguirá por aqui."),
        };
      }
      steps[stepId] = {
        id: stepId,
        type: "send_text",
        text: step.message.trim(),
        next_step: nextStep,
      };
      continue;
    }

    if (step.kind === "input") {
      let nextStep = typeof step.next === "string" && step.next.trim() ? step.next.trim() : undefined;
      if (!nextStep && step.complete) {
        nextStep = makeSyntheticCompleteStepId(stepId, "input");
        syntheticCompleteSteps[nextStep] = {
          id: nextStep,
          type: "complete",
          text: textFromCompleteAction(step, "Perfeito, concluí essa etapa."),
        };
      }
      steps[stepId] = {
        id: stepId,
        type: "ask_text",
        prompt: step.prompt.trim(),
        invalid_prompt: step.prompt.trim(),
        answer_key: step.field.trim(),
        next_step: nextStep || "concluido",
        min_length: step.input_type === "email" ? 5 : 2,
        validator: step.input_type === "email" ? "email" : "text",
      };
      continue;
    }

    if (step.kind === "media") {
      const nextStep = typeof step.next === "string" && step.next.trim() ? step.next.trim() : undefined;
      steps[stepId] = {
        id: stepId,
        type: "send_media",
        media_type: step.media_type,
        file: step.file.trim(),
        caption: step.caption?.trim() || undefined,
        next_step: nextStep,
      };
      continue;
    }

    if (step.kind === "menu") {
      const choices = step.options.map((option) => {
        let nextStep = typeof option.next === "string" && option.next.trim() ? option.next.trim() : undefined;
        if (!nextStep && option.complete) {
          nextStep = makeSyntheticCompleteStepId(stepId, option.id);
          syntheticCompleteSteps[nextStep] = {
            id: nextStep,
            type: "complete",
            text: option.complete.summary?.trim() || "Perfeito, vou encaminhar internamente e seguimos por aqui.",
          };
        }
        if (!nextStep && step.on_select?.[option.id]) {
          nextStep = String(step.on_select[option.id]).trim() || undefined;
        }
        return {
          id: option.id.trim(),
          label: option.label.trim(),
          next_step: nextStep,
        };
      });

      const menuField =
        "field" in step && typeof step.field === "string" && step.field.trim()
          ? step.field.trim()
          : stepId;

      const resolvedMenuType =
        step.menu_type === "button" || step.menu_type === "list"
          ? step.menu_type
          : choices.length <= 3
            ? "button"
            : "list";

      steps[stepId] = {
        id: stepId,
        type: "menu",
        text: step.prompt.trim(),
        menu_type: resolvedMenuType,
        list_button:
          resolvedMenuType === "list"
            ? (step.list_button?.trim() || "Ver opções")
            : undefined,
        answer_key: menuField,
        invalid_prompt: "Escolha uma opção válida no menu para continuarmos.",
        choices,
      };
      continue;
    }

    if (step.kind === "complete") {
      const transfer = extrairTransferDoPassoComplete(step);
      const nextStep = typeof step.next === "string" && step.next.trim() ? step.next.trim() : undefined;
      steps[stepId] = {
        id: stepId,
        type: "complete",
        text: textFromCompleteAction(step, "Concluído. Nosso time seguirá com você por aqui."),
        next_step: nextStep,
        transfer,
      };
    }
  }

  return {
    start_step: definition.entry_step_id.trim(),
    steps: {
      ...steps,
      ...syntheticCompleteSteps,
    },
  };
}

regAlias("Projeto arquitetura / design", "triagem_arq");
regAlias("Comprar, vender ou alugar imóvel", "triagem_imob");
regAlias("Arquiteto/corretor homologação", "triagem_homolog");
regAlias("Proprietário anunciar imóvel", "triagem_prop_anunciar");
regAlias("Apartamento", "arq_tipo_ap");
regAlias("Casa", "arq_tipo_casa");
regAlias("Comercial", "arq_tipo_com");
regAlias("Industrial", "arq_tipo_ind");
regAlias("Até 50", "arq_m2_ate50");
regAlias("51-250", "arq_m2_51_250");
regAlias("251-500", "arq_m2_251_500");
regAlias("Mais 500", "arq_m2_mais500");
regAlias("Não sei", "arq_m2_ns");
regAlias("Imediato", "arq_prazo_imediato");
regAlias("30d", "arq_prazo_30");
regAlias("60d", "arq_prazo_60");
regAlias("90d", "arq_prazo_90");
regAlias("Mais pra frente", "arq_prazo_mais");
regAlias("Comprar", "imob_comprar");
regAlias("Vender", "imob_vender");
regAlias("Alugar", "imob_alugar");
regAlias("Anunciar", "imob_anunciar");
regAlias("Cadastrar imóvel", "parc_cadastro");
regAlias("Parceria", "parc_parceria");
regAlias("Buscar imóvel", "fluxo1");
regAlias("Anunciar imóvel", "fluxo2");
regAlias("Sou corretor/imobiliária", "fluxo3");
regAlias("Imóveis", "fluxo_imobiliario");
regAlias("Arquitetura", "fluxo_arquitetura");

/** Apenas para fallback hardcoded legado (Maria/Obra10+), não para fluxo dinâmico publicado. */
export function agenteUsaPlaybookLegadoMari(agenteSlug: string): boolean {
  if (process.env.WHATSAPP_PLAYBOOK_MARIA === "0") return false;
  const s = agenteSlug.trim().toLowerCase();
  if (!s) return false;
  if (/^mari/.test(s) || s === "maria") return true;
  const extra = (process.env.WHATSAPP_PLAYBOOK_MARIA_SLUGS || "")
    .split(/[,;\s]+/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  if (extra.includes(s)) return true;
  if (process.env.WHATSAPP_PLAYBOOK_MARIA === "all") return true;
  return false;
}

/** @deprecated Use agenteUsaPlaybookLegadoMari */
export const agenteUsaPlaybookMaria = agenteUsaPlaybookLegadoMari;

export function resolverChoiceId(mensagem: string, menuChoiceId?: string | null): string | null {
  const candidates = [menuChoiceId, mensagem].filter(
    (x): x is string => typeof x === "string" && Boolean(x.trim())
  );
  for (const raw of candidates) {
    const t = raw.trim();
    if (KNOWN_CHOICE_IDS.has(t)) return t;
    const lower = t.toLowerCase();
    if (KNOWN_CHOICE_IDS.has(lower)) return lower;
    const alias = CHOICE_ALIASES.get(normAlias(t));
    if (alias) return alias;
    const pipeId = t.includes("|") ? t.split("|").pop()?.trim() : "";
    if (pipeId && KNOWN_CHOICE_IDS.has(pipeId)) return pipeId;
  }
  return null;
}

function lerMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return { ...(metadata as Record<string, unknown>) };
}

export function lerEstadoPlaybook(metadata: unknown): {
  step: PlaybookStep | null;
  answers: PlaybookAnswers;
  active: boolean;
  complete: boolean;
} {
  const m = lerMetadata(metadata);
  const stepRaw = typeof m.wa_playbook_step === "string" ? m.wa_playbook_step.trim() : "";
  const step = stepRaw && stepRaw !== "concluido" ? (stepRaw as PlaybookStep) : stepRaw === "concluido" ? "concluido" : null;
  const answers: PlaybookAnswers = {};
  const ans = m.wa_playbook_answers;
  if (ans && typeof ans === "object" && !Array.isArray(ans)) {
    for (const [k, v] of Object.entries(ans as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) answers[k] = v.trim();
    }
  }
  const active = m.wa_playbook_active === true;
  const complete = step === "concluido" || m.wa_playbook_complete === true;
  return { step, answers, active, complete };
}

async function persistirEstado(
  supabase: SupabaseClient,
  leadId: string,
  metaBase: Record<string, unknown>,
  patch: {
    step?: PlaybookStep | null;
    answers?: PlaybookAnswers;
    active?: boolean;
    complete?: boolean;
    resetAnswers?: boolean;
  }
): Promise<Record<string, unknown>> {
  const meta = { ...metaBase };
  if (patch.step !== undefined) {
    if (patch.step) meta.wa_playbook_step = patch.step;
    else delete meta.wa_playbook_step;
  }
  if (patch.answers !== undefined) {
    if (patch.resetAnswers) {
      meta.wa_playbook_answers = { ...patch.answers };
    } else {
      const prev =
        meta.wa_playbook_answers && typeof meta.wa_playbook_answers === "object"
          ? { ...(meta.wa_playbook_answers as Record<string, string>) }
          : {};
      meta.wa_playbook_answers = { ...prev, ...patch.answers };
    }
  }
  if (patch.active !== undefined) meta.wa_playbook_active = patch.active;
  if (patch.complete !== undefined) {
    meta.wa_playbook_complete = patch.complete;
    if (patch.complete) meta.wa_playbook_active = false;
  }
  meta.wa_playbook_updated_at = new Date().toISOString();
  await supabase.from("hub_leads_crm").update({ metadata: meta }).eq("id", leadId);
  return meta;
}

async function atualizarLeadPlaybook(
  supabase: SupabaseClient,
  leadId: string,
  agenteSlug: string,
  args: Record<string, unknown>
): Promise<void> {
  const { data: leadAtual } = await supabase
    .from("hub_leads_crm")
    .select("id, estagio, score, valor_estimado, tags, metadata, preferencias, nome, telefone, interesse_principal")
    .eq("id", leadId)
    .maybeSingle();
  if (!leadAtual) return;

  const built = buildHubLeadsCrmPatch(args, leadAtual as Record<string, unknown>);
  if (!built.ok) return;

  await supabase.from("hub_leads_crm").update(built.patch).eq("id", leadId);

  await supabase.from("hub_acoes_ia").insert({
    agente_slug: agenteSlug,
    tipo: "memoria_salva",
    descricao: "Lead actualizado via playbook Maria",
    lead_id: leadId,
    sucesso: true,
    metadata: { origem: "playbook_flow_maria", campos: Object.keys(built.patch) },
  });
}

function metadataFluxoParaTriagem(choiceId: string): Record<string, unknown> {
  switch (choiceId) {
    case "triagem_arq":
      return {
        fluxo_ativo: "fluxo_arquitetura",
        lead_kind: "cliente_projetos",
        servico_solicitado: "Arquitetura / design",
      };
    case "triagem_imob":
      return { fluxo_ativo: "fluxo_imobiliario", lead_kind: "cliente_imobiliario" };
    case "triagem_homolog":
      return {
        fluxo_ativo: "fluxo3",
        lead_kind: "imobiliaria_corretor",
        servico_solicitado: "Homologação profissional",
      };
    case "triagem_prop_anunciar":
      return {
        fluxo_ativo: "fluxo2",
        lead_kind: "cliente_imobiliario",
        intencao_imobiliario: "proprietario_venda_ou_locacao",
        modo_imobiliario: "detalhado",
      };
    case "triagem_outro":
      return { fluxo_ativo: "outro", lead_kind: "outro" };
    default:
      return {};
  }
}

function mensagemPareceNome(mensagem: string): boolean {
  const t = mensagem.trim();
  if (t.length < 2 || t.length > 60) return false;
  if (resolverChoiceId(t, null)) return false;
  if (mensagemEhSaudacaoSimples(t)) return false;
  if (/^\d+$/.test(t)) return false;
  if (t.includes("@")) return false;
  return true;
}

function mensagemPareceEmail(mensagem: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mensagem.trim());
}

async function enviarTexto(telefone: string, texto: string, instanceToken: string) {
  const out = await whatsappSendText(telefone, texto, { instanceToken });
  const ctx = playbookPersistenciaCrm;
  if (out.ok && ctx && texto.trim()) {
    await persistirMensagemSaidaIaCrm(ctx.supabase, {
      leadId: ctx.leadId,
      agenteSlug: ctx.agenteSlug,
      conteudo: texto,
      tenantId: ctx.tenantId,
      motor: "playbook_flow",
    }).catch(() => undefined);
  }
  return out;
}

type PlaybookPersistenciaCrm = {
  supabase: SupabaseClient;
  leadId: string;
  agenteSlug: string;
  tenantId?: string | null;
};

let playbookPersistenciaCrm: PlaybookPersistenciaCrm | null = null;

async function enviarMedia(
  telefone: string,
  instanceToken: string,
  args: { mediaType: "image" | "document" | "video"; file: string; caption?: string }
) {
  const out = await whatsappSendMedia(telefone, {
    type: args.mediaType,
    file: args.file,
    caption: args.caption,
    instanceToken,
  });
  return { ok: out.ok, erro: out.ok ? undefined : out.error };
}

async function enviarLista(
  telefone: string,
  instanceToken: string,
  texto: string,
  choices: string[],
  listButton = "Ver opções",
  footerText?: string
) {
  return enviarMenuUazapi({
    telefone,
    instanceToken,
    texto,
    tipo: "list",
    choices,
    listButton,
    footerText: menuFooterEmpresa(footerText),
  });
}

async function enviarBotoes(
  telefone: string,
  instanceToken: string,
  texto: string,
  choices: string[],
  footerText?: string
) {
  return enviarMenuUazapi({
    telefone,
    instanceToken,
    texto,
    tipo: "button",
    choices,
    footerText: menuFooterEmpresa(footerText),
  });
}

const MENU_ARQ_TIPO = [
  "[Tipo de imóvel]",
  "Apartamento|arq_tipo_ap",
  "Casa|arq_tipo_casa",
  "Comercial|arq_tipo_com",
  "Industrial|arq_tipo_ind",
  "Outro|arq_tipo_outro",
];

const MENU_ARQ_TAMANHO = [
  "[Tamanho aproximado]",
  "Até 50 m²|arq_m2_ate50",
  "51 a 250 m²|arq_m2_51_250",
  "251 a 500 m²|arq_m2_251_500",
  "Mais de 500 m²|arq_m2_mais500",
  "Não sei|arq_m2_ns",
];

const MENU_ARQ_PRAZO = [
  "[Prazo para iniciar]",
  "Imediato|arq_prazo_imediato",
  "Até 30 dias|arq_prazo_30",
  "Até 60 dias|arq_prazo_60",
  "Até 90 dias|arq_prazo_90",
  "Mais pra frente|arq_prazo_mais",
];

const MENU_IMOB_SUB = [
  "[O que você busca?]",
  "Comprar|imob_comprar",
  "Vender|imob_vender",
  "Alugar|imob_alugar",
  "Anunciar|imob_anunciar",
  "Outro|imob_outro",
];

const MENU_PROP_TAMANHO = MENU_ARQ_TAMANHO;

const MENU_PROP_INTENCAO = ["Vender|prop_vender", "Alugar|prop_alugar"];

const MENU_PARC_TIPO = ["Cadastrar imóvel|parc_cadastro", "Parceria|parc_parceria"];

async function aplicarConclusaoPassoDinamico(
  supabase: SupabaseClient,
  ctx: {
    leadId: string;
    telefone: string;
    leadNome?: string | null;
    agenteSlug: string;
    instanceToken: string;
    definition: FlowEngineDefinition;
  },
  stepId: string,
  answers: Record<string, string>
): Promise<void> {
  const engineStep = ctx.definition.steps[stepId];
  if (engineStep?.type !== "complete") return;

  if (engineStep.transfer) {
    await executarAcaoTransferenciaFluxo(supabase, {
      leadId: ctx.leadId,
      leadTelefone: ctx.telefone,
      leadNome: ctx.leadNome,
      agenteSlug: ctx.agenteSlug,
      instanceToken: ctx.instanceToken,
      stepId,
      transfer: engineStep.transfer,
      answers,
    });
    return;
  }

  if (ctx.definition.steps[stepId]?.type === "complete") {
    await atualizarLeadPlaybook(supabase, ctx.leadId, ctx.agenteSlug, {
      metadata: { wa_playbook_complete: true },
    });
  }
}

async function encaminharArquitetura(
  ctx: FlowCtx,
  answers: PlaybookAnswers
): Promise<PlaybookProcessResult> {
  await enviarTexto(
    ctx.telefone,
    "Perfeito, obrigado pelas informações! Já vou encaminhar seu contato para nossa equipe de arquitetos. Em breve alguém fala com você por aqui.",
    ctx.instanceToken
  );
  await atualizarLeadPlaybook(ctx.supabase, ctx.leadId, ctx.agenteSlug, {
    estagio: "qualificado",
    metadata: {
      fluxo_ativo: "fluxo_arquitetura",
      lead_kind: "cliente_projetos",
      potencial: "MEDIO",
      tipo_imovel_projeto: answers.arq_tipo || null,
      tamanho_imovel: answers.arq_tamanho || null,
      cidade_bairro_projeto: answers.arq_localizacao || null,
      prazo: answers.arq_prazo || null,
      wa_playbook_complete: true,
    },
  });
  await persistirEstado(ctx.supabase, ctx.leadId, ctx.meta, {
    step: "concluido",
    complete: true,
    active: false,
  });
  return { handled: true, skipIa: true, step: "concluido" };
}

async function encaminharCorretorCliente(ctx: FlowCtx): Promise<PlaybookProcessResult> {
  await enviarTexto(
    ctx.telefone,
    "Eu cuido desse primeiro contato e já vou te direcionar para o corretor responsável. Ele vai te chamar por aqui com todas as informações.",
    ctx.instanceToken
  );
  await atualizarLeadPlaybook(ctx.supabase, ctx.leadId, ctx.agenteSlug, {
    estagio: "qualificado",
    metadata: {
      fluxo_ativo: "fluxo1",
      lead_kind: "cliente_imobiliario",
      modo_imobiliario: "rapido",
      intencao_imobiliario: "cliente_final_compra_locacao",
      potencial: "ALTO",
      wa_playbook_complete: true,
    },
  });
  await persistirEstado(ctx.supabase, ctx.leadId, ctx.meta, {
    step: "concluido",
    complete: true,
    active: false,
  });
  return { handled: true, skipIa: true, step: "concluido" };
}

async function encaminharProprietario(
  ctx: FlowCtx,
  answers: PlaybookAnswers
): Promise<PlaybookProcessResult> {
  await enviarTexto(
    ctx.telefone,
    "Recebi as informações do seu imóvel! Nossa equipe vai analisar e um corretor entra em contato em breve por aqui.",
    ctx.instanceToken
  );
  await atualizarLeadPlaybook(ctx.supabase, ctx.leadId, ctx.agenteSlug, {
    estagio: "qualificado",
    metadata: {
      fluxo_ativo: "fluxo2",
      lead_kind: "cliente_imobiliario",
      modo_imobiliario: "detalhado",
      intencao_imobiliario: "proprietario_venda_ou_locacao",
      potencial: "MEDIO",
      intencao_proprietario: answers.prop_intencao || answers.imob_sub || null,
      cidade_bairro_imovel: answers.prop_localizacao || answers.parc_imovel_localizacao || null,
      tamanho_imovel: answers.prop_tamanho || answers.parc_imovel_tamanho || null,
      valor_imovel: answers.prop_valor || answers.parc_imovel_valor || null,
      wa_playbook_complete: true,
    },
  });
  await persistirEstado(ctx.supabase, ctx.leadId, ctx.meta, {
    step: "concluido",
    complete: true,
    active: false,
  });
  return { handled: true, skipIa: true, step: "concluido" };
}

async function encaminharParceria(ctx: FlowCtx): Promise<PlaybookProcessResult> {
  await enviarTexto(
    ctx.telefone,
    "Vou encaminhar para o time de parcerias. Alguém entra em contato em breve por aqui!",
    ctx.instanceToken
  );
  await atualizarLeadPlaybook(ctx.supabase, ctx.leadId, ctx.agenteSlug, {
    estagio: "qualificado",
    metadata: {
      fluxo_ativo: "fluxo3",
      lead_kind: "imobiliaria_corretor",
      potencial: "MEDIO",
      wa_playbook_complete: true,
    },
  });
  await persistirEstado(ctx.supabase, ctx.leadId, ctx.meta, {
    step: "concluido",
    complete: true,
    active: false,
  });
  return { handled: true, skipIa: true, step: "concluido" };
}

type FlowCtx = {
  supabase: SupabaseClient;
  leadId: string;
  telefone: string;
  instanceToken: string;
  agenteSlug: string;
  mensagem: string;
  menuChoiceId?: string | null;
  tipoMidia: string;
  meta: Record<string, unknown>;
  answers: PlaybookAnswers;
  leadNome?: string | null;
};

async function iniciarSaudacao(ctx: FlowCtx): Promise<PlaybookProcessResult> {
  await enviarTexto(
    ctx.telefone,
    "Olá! Sou a Mari, do HUB Obra 10+. É um prazer falar com você.\n\nMe fale qual é o seu nome, por gentileza?",
    ctx.instanceToken
  );
  const meta = await persistirEstado(ctx.supabase, ctx.leadId, ctx.meta, {
    step: "aguardar_nome",
    active: true,
    complete: false,
  });
  ctx.meta = meta;
  return { handled: true, skipIa: true, step: "aguardar_nome" };
}

const CHOICES_TRIAGEM_INICIAL = [
  "[O que você precisa hoje?]",
  "Projeto arquitetura / design|triagem_arq",
  "Comprar, vender ou alugar imóvel|triagem_imob",
  "Arquiteto/corretor homologação|triagem_homolog",
  "Proprietário anunciar imóvel|triagem_prop_anunciar",
  "Outro|triagem_outro",
] as const;

async function enviarTriagemInicialLista(
  ctx: FlowCtx,
  textoIntro?: string
): Promise<{ ok: boolean; erro?: string }> {
  const nome = (ctx.answers.nome || "").trim();
  const intro =
    textoIntro?.trim() ||
    (nome
      ? `Obrigado, ${nome}! Para te orientar melhor, escolha uma opção abaixo:`
      : "Para te orientar melhor, escolha uma opção abaixo:");
  const menu = await enviarLista(ctx.telefone, ctx.instanceToken, intro, [...CHOICES_TRIAGEM_INICIAL]);
  if (menu.ok) {
    await marcarMenuTriagemEnviado(ctx.supabase, ctx.leadId);
  }
  return menu;
}

async function reenviarMenuTriagemInicial(ctx: FlowCtx): Promise<PlaybookProcessResult> {
  const menu = await enviarTriagemInicialLista(ctx);
  if (!menu.ok) {
    await enviarTexto(
      ctx.telefone,
      "Não consegui abrir o menu interativo agora. Tente de novo em instantes ou diga o que precisa (arquitetura, imóvel, parceria).",
      ctx.instanceToken
    );
    console.warn("[playbook-flow] menu triagem falhou:", menu.erro);
  }
  const meta = await persistirEstado(ctx.supabase, ctx.leadId, ctx.meta, {
    step: "triagem_inicial",
    answers: ctx.answers,
    active: true,
    complete: false,
  });
  ctx.meta = meta;
  return { handled: true, skipIa: true, step: "triagem_inicial" };
}

async function aposNomeEnviarTriagem(ctx: FlowCtx, nome: string): Promise<PlaybookProcessResult> {
  await atualizarLeadPlaybook(ctx.supabase, ctx.leadId, ctx.agenteSlug, { nome });
  const primeiro = nome.split(/\s+/)[0] || nome;
  await enviarTexto(
    ctx.telefone,
    `Olá! Sou a Mari, do HUB Obra 10+. É um prazer falar com você, ${primeiro}!`,
    ctx.instanceToken
  );
  ctx.answers.nome = nome;
  await enviarTriagemInicialLista(ctx, "Para te orientar melhor, escolha uma opção abaixo:");
  const meta = await persistirEstado(ctx.supabase, ctx.leadId, ctx.meta, {
    step: "triagem_inicial",
    answers: { nome },
    active: true,
    complete: false,
  });
  ctx.meta = meta;
  return { handled: true, skipIa: true, step: "triagem_inicial" };
}

async function rotearTriagemInicial(ctx: FlowCtx, choiceId: string): Promise<PlaybookProcessResult> {
  const fluxoMeta = metadataFluxoParaTriagem(choiceId);
  await atualizarLeadPlaybook(ctx.supabase, ctx.leadId, ctx.agenteSlug, {
    metadata: { ...fluxoMeta, triagem_escolha: choiceId },
  });

  const answers = { ...ctx.answers, triagem: choiceId };

  switch (choiceId) {
    case "triagem_arq":
      await enviarLista(
        ctx.telefone,
        ctx.instanceToken,
        "Qual o tipo de imóvel do seu projeto?",
        MENU_ARQ_TIPO
      );
      await persistirEstado(ctx.supabase, ctx.leadId, ctx.meta, {
        step: "arq_tipo_imovel",
        answers: { triagem: choiceId },
        active: true,
      });
      return { handled: true, skipIa: true, step: "arq_tipo_imovel" };

    case "triagem_imob":
      await enviarLista(ctx.telefone, ctx.instanceToken, "O que você busca no mercado imobiliário?", MENU_IMOB_SUB);
      await persistirEstado(ctx.supabase, ctx.leadId, ctx.meta, {
        step: "imob_sub",
        answers: { triagem: choiceId },
        active: true,
      });
      return { handled: true, skipIa: true, step: "imob_sub" };

    case "triagem_homolog":
      await enviarTexto(
        ctx.telefone,
        "Para seguir com homologação ou parceria, qual é o seu e-mail de contato?",
        ctx.instanceToken
      );
      await persistirEstado(ctx.supabase, ctx.leadId, ctx.meta, {
        step: "parc_email",
        answers: { triagem: choiceId, parc_origem: "homologacao" },
        active: true,
      });
      return { handled: true, skipIa: true, step: "parc_email" };

    case "triagem_prop_anunciar":
      await enviarBotoes(
        ctx.telefone,
        ctx.instanceToken,
        "Você quer vender ou alugar esse imóvel?",
        MENU_PROP_INTENCAO
      );
      await persistirEstado(ctx.supabase, ctx.leadId, ctx.meta, {
        step: "prop_intencao",
        answers: { triagem: choiceId, imob_sub: "imob_anunciar" },
        active: true,
      });
      return { handled: true, skipIa: true, step: "prop_intencao" };

    case "triagem_outro":
      await enviarTexto(
        ctx.telefone,
        "Sem problema! Conte em poucas palavras o que você precisa que eu encaminho para o time certo.",
        ctx.instanceToken
      );
      await persistirEstado(ctx.supabase, ctx.leadId, ctx.meta, {
        step: "outro_descricao",
        answers: { triagem: choiceId },
        active: true,
      });
      return { handled: true, skipIa: true, step: "outro_descricao" };

    default:
      return { handled: false };
  }
}

async function rotearImobSub(ctx: FlowCtx, choiceId: string): Promise<PlaybookProcessResult> {
  const answers = { ...ctx.answers, imob_sub: choiceId };
  await atualizarLeadPlaybook(ctx.supabase, ctx.leadId, ctx.agenteSlug, {
    metadata: { intencao_imob_sub: choiceId },
  });

  if (choiceId === "imob_comprar" || choiceId === "imob_alugar") {
    return encaminharCorretorCliente({ ...ctx, answers });
  }

  if (choiceId === "imob_outro") {
    await enviarTexto(
      ctx.telefone,
      "Conte um pouco do que você precisa que eu encaminho para o time.",
      ctx.instanceToken
    );
    await persistirEstado(ctx.supabase, ctx.leadId, ctx.meta, {
      step: "outro_descricao",
      answers,
      active: true,
    });
    return { handled: true, skipIa: true, step: "outro_descricao" };
  }

  if (choiceId === "imob_vender" || choiceId === "imob_anunciar") {
    if (choiceId === "imob_vender") {
      await persistirEstado(ctx.supabase, ctx.leadId, ctx.meta, {
        step: "prop_localizacao",
        answers: { ...answers, prop_intencao: "prop_vender" },
        active: true,
      });
      await enviarTexto(
        ctx.telefone,
        "Qual a cidade e bairro do imóvel?",
        ctx.instanceToken
      );
      return { handled: true, skipIa: true, step: "prop_localizacao" };
    }
    await enviarBotoes(
      ctx.telefone,
      ctx.instanceToken,
      "Você quer vender ou alugar esse imóvel?",
      MENU_PROP_INTENCAO
    );
    await persistirEstado(ctx.supabase, ctx.leadId, ctx.meta, {
      step: "prop_intencao",
      answers,
      active: true,
    });
    return { handled: true, skipIa: true, step: "prop_intencao" };
  }

  return { handled: false };
}

async function processarPasso(
  step: PlaybookStep,
  ctx: FlowCtx
): Promise<PlaybookProcessResult> {
  const choiceId = resolverChoiceId(ctx.mensagem, ctx.menuChoiceId);
  const texto = ctx.mensagem.trim();

  switch (step) {
    case "aguardar_nome": {
      if (mensagemPedeMenuOuOpcoes(texto)) {
        return reenviarMenuTriagemInicial(ctx);
      }
      if (mensagemPareceNome(texto)) {
        return aposNomeEnviarTriagem(ctx, texto);
      }
      await enviarTexto(
        ctx.telefone,
        "Para eu te atender melhor, me diz seu nome por favor?",
        ctx.instanceToken
      );
      return { handled: true, skipIa: true, step };
    }

    case "triagem_inicial": {
      if (!choiceId) {
        if (mensagemEhSaudacaoSimples(texto)) {
          return iniciarSaudacao(ctx);
        }
        if (mensagemPedeMenuOuOpcoes(texto)) {
          return reenviarMenuTriagemInicial(ctx);
        }
        await enviarTexto(ctx.telefone, "Toque em uma das opções do menu acima para continuarmos.", ctx.instanceToken);
        await enviarTriagemInicialLista(ctx, "Se o menu não apareceu, toque no botão abaixo:");
        return { handled: true, skipIa: true, step };
      }
      return rotearTriagemInicial(ctx, choiceId);
    }

    case "arq_tipo_imovel": {
      if (!choiceId?.startsWith("arq_tipo_")) {
        await enviarTexto(ctx.telefone, "Escolha o tipo de imóvel no menu, por favor.", ctx.instanceToken);
        return { handled: true, skipIa: true, step };
      }
      await enviarLista(
        ctx.telefone,
        ctx.instanceToken,
        "Qual o tamanho aproximado do projeto?",
        MENU_ARQ_TAMANHO
      );
      await persistirEstado(ctx.supabase, ctx.leadId, ctx.meta, {
        step: "arq_tamanho",
        answers: { arq_tipo: choiceId },
        active: true,
      });
      return { handled: true, skipIa: true, step: "arq_tamanho" };
    }

    case "arq_tamanho": {
      if (!choiceId?.startsWith("arq_m2_")) {
        await enviarTexto(ctx.telefone, "Escolha uma faixa de tamanho no menu.", ctx.instanceToken);
        return { handled: true, skipIa: true, step };
      }
      await enviarTexto(
        ctx.telefone,
        "Em qual cidade e bairro fica o projeto?",
        ctx.instanceToken
      );
      await persistirEstado(ctx.supabase, ctx.leadId, ctx.meta, {
        step: "arq_localizacao",
        answers: { ...ctx.answers, arq_tamanho: choiceId },
        active: true,
      });
      return { handled: true, skipIa: true, step: "arq_localizacao" };
    }

    case "arq_localizacao": {
      if (!texto || texto.length < 3 || choiceId) {
        await enviarTexto(ctx.telefone, "Informe cidade e bairro em texto, por favor.", ctx.instanceToken);
        return { handled: true, skipIa: true, step };
      }
      await enviarLista(
        ctx.telefone,
        ctx.instanceToken,
        "Para quando você pretende iniciar o projeto?",
        MENU_ARQ_PRAZO
      );
      await persistirEstado(ctx.supabase, ctx.leadId, ctx.meta, {
        step: "arq_prazo",
        answers: { ...ctx.answers, arq_localizacao: texto },
        active: true,
      });
      return { handled: true, skipIa: true, step: "arq_prazo" };
    }

    case "arq_prazo": {
      if (!choiceId?.startsWith("arq_prazo_")) {
        await enviarTexto(ctx.telefone, "Escolha o prazo no menu, por favor.", ctx.instanceToken);
        return { handled: true, skipIa: true, step };
      }
      return encaminharArquitetura(ctx, { ...ctx.answers, arq_prazo: choiceId });
    }

    case "imob_sub": {
      if (!choiceId) {
        await enviarTexto(ctx.telefone, "Escolha uma opção no menu para continuarmos.", ctx.instanceToken);
        return { handled: true, skipIa: true, step };
      }
      return rotearImobSub(ctx, choiceId);
    }

    case "prop_intencao": {
      if (!choiceId || (choiceId !== "prop_vender" && choiceId !== "prop_alugar")) {
        await enviarTexto(ctx.telefone, "Toque em Vender ou Alugar no menu.", ctx.instanceToken);
        return { handled: true, skipIa: true, step };
      }
      await enviarTexto(ctx.telefone, "Qual a cidade e bairro do imóvel?", ctx.instanceToken);
      await persistirEstado(ctx.supabase, ctx.leadId, ctx.meta, {
        step: "prop_localizacao",
        answers: { ...ctx.answers, prop_intencao: choiceId },
        active: true,
      });
      return { handled: true, skipIa: true, step: "prop_localizacao" };
    }

    case "prop_localizacao":
    case "parc_imovel_localizacao": {
      if (!texto || texto.length < 3 || choiceId) {
        await enviarTexto(ctx.telefone, "Informe cidade e bairro em texto.", ctx.instanceToken);
        return { handled: true, skipIa: true, step };
      }
      const nextStep = step === "parc_imovel_localizacao" ? "parc_imovel_tamanho" : "prop_tamanho";
      const key = step === "parc_imovel_localizacao" ? "parc_imovel_localizacao" : "prop_localizacao";
      await enviarLista(ctx.telefone, ctx.instanceToken, "Qual o tamanho aproximado do imóvel?", MENU_PROP_TAMANHO);
      await persistirEstado(ctx.supabase, ctx.leadId, ctx.meta, {
        step: nextStep,
        answers: { ...ctx.answers, [key]: texto },
        active: true,
      });
      return { handled: true, skipIa: true, step: nextStep };
    }

    case "prop_tamanho":
    case "parc_imovel_tamanho": {
      if (!choiceId?.startsWith("arq_m2_")) {
        await enviarTexto(ctx.telefone, "Escolha o tamanho no menu.", ctx.instanceToken);
        return { handled: true, skipIa: true, step };
      }
      const nextStep = step === "parc_imovel_tamanho" ? "parc_imovel_valor" : "prop_valor";
      const key = step === "parc_imovel_tamanho" ? "parc_imovel_tamanho" : "prop_tamanho";
      await enviarTexto(
        ctx.telefone,
        "Qual o valor de referência do imóvel? (pode ser uma faixa aproximada)",
        ctx.instanceToken
      );
      await persistirEstado(ctx.supabase, ctx.leadId, ctx.meta, {
        step: nextStep,
        answers: { ...ctx.answers, [key]: choiceId },
        active: true,
      });
      return { handled: true, skipIa: true, step: nextStep };
    }

    case "prop_valor":
    case "parc_imovel_valor": {
      if (!texto || texto.length < 2) {
        await enviarTexto(ctx.telefone, "Informe o valor ou uma faixa aproximada.", ctx.instanceToken);
        return { handled: true, skipIa: true, step };
      }
      const nextStep = step === "parc_imovel_valor" ? "parc_imovel_midias" : "prop_midias";
      const key = step === "parc_imovel_valor" ? "parc_imovel_valor" : "prop_valor";
      await enviarTexto(
        ctx.telefone,
        "Se quiser, envie fotos do imóvel agora. Caso prefira seguir sem fotos, responda *ok*.",
        ctx.instanceToken
      );
      await persistirEstado(ctx.supabase, ctx.leadId, ctx.meta, {
        step: nextStep,
        answers: { ...ctx.answers, [key]: texto },
        active: true,
      });
      return { handled: true, skipIa: true, step: nextStep };
    }

    case "prop_midias":
    case "parc_imovel_midias": {
      const midiaOk =
        ctx.tipoMidia !== "texto" ||
        /^ok$/i.test(texto) ||
        texto.length > 0;
      if (!midiaOk) {
        return { handled: true, skipIa: true, step };
      }
      const answers = {
        ...ctx.answers,
        ...(step === "parc_imovel_midias"
          ? { parc_imovel_midias: ctx.tipoMidia !== "texto" ? ctx.tipoMidia : texto }
          : { prop_midias: ctx.tipoMidia !== "texto" ? ctx.tipoMidia : texto }),
      };
      return encaminharProprietario(ctx, answers);
    }

    case "parc_email": {
      if (!mensagemPareceEmail(texto)) {
        await enviarTexto(ctx.telefone, "Por favor, envie um e-mail válido para contato.", ctx.instanceToken);
        return { handled: true, skipIa: true, step };
      }
      await atualizarLeadPlaybook(ctx.supabase, ctx.leadId, ctx.agenteSlug, { email: texto });
      await enviarBotoes(
        ctx.telefone,
        ctx.instanceToken,
        "Você quer cadastrar um imóvel ou falar sobre parceria?",
        MENU_PARC_TIPO
      );
      await persistirEstado(ctx.supabase, ctx.leadId, ctx.meta, {
        step: "parc_tipo",
        answers: { ...ctx.answers, parc_email: texto },
        active: true,
      });
      return { handled: true, skipIa: true, step: "parc_tipo" };
    }

    case "parc_tipo": {
      if (choiceId === "parc_parceria") {
        return encaminharParceria(ctx);
      }
      if (choiceId === "parc_cadastro") {
        await enviarTexto(ctx.telefone, "Qual a cidade e bairro do imóvel?", ctx.instanceToken);
        await persistirEstado(ctx.supabase, ctx.leadId, ctx.meta, {
          step: "parc_imovel_localizacao",
          answers: { ...ctx.answers, parc_tipo: choiceId },
          active: true,
        });
        return { handled: true, skipIa: true, step: "parc_imovel_localizacao" };
      }
      await enviarTexto(ctx.telefone, "Escolha Cadastrar imóvel ou Parceria no menu.", ctx.instanceToken);
      return { handled: true, skipIa: true, step };
    }

    case "outro_descricao": {
      if (!texto || texto.length < 3) {
        await enviarTexto(ctx.telefone, "Pode descrever brevemente o que você precisa?", ctx.instanceToken);
        return { handled: true, skipIa: true, step };
      }
      await enviarTexto(
        ctx.telefone,
        "Obrigado! Já encaminhei para o time responsável. Em breve alguém fala com você por aqui.",
        ctx.instanceToken
      );
      await atualizarLeadPlaybook(ctx.supabase, ctx.leadId, ctx.agenteSlug, {
        metadata: {
          fluxo_ativo: "outro",
          caracteristicas_adicionais: texto,
          wa_playbook_complete: true,
        },
      });
      await persistirEstado(ctx.supabase, ctx.leadId, ctx.meta, {
        step: "concluido",
        answers: { ...ctx.answers, outro_descricao: texto },
        complete: true,
        active: false,
      });
      return { handled: true, skipIa: true, step: "concluido" };
    }

    default:
      return { handled: false };
  }
}

async function processarPlaybookInboundHardcoded(params: {
  supabase: SupabaseClient;
  leadId: string;
  telefone: string;
  mensagem: string;
  menuChoiceId?: string | null;
  tipoMidia: string;
  agenteSlug: string;
  instanceToken: string;
  isNovo: boolean;
  leadNome?: string | null;
  metadata: unknown;
}): Promise<PlaybookProcessResult> {
  const { step, answers, active, complete } = lerEstadoPlaybook(params.metadata);
  const pedeMenu = mensagemPedeMenuOuOpcoes(params.mensagem);

  let meta = lerMetadata(params.metadata);

  const ctx: FlowCtx = {
    supabase: params.supabase,
    leadId: params.leadId,
    telefone: params.telefone,
    instanceToken: params.instanceToken,
    agenteSlug: params.agenteSlug,
    mensagem: params.mensagem,
    menuChoiceId: params.menuChoiceId,
    tipoMidia: params.tipoMidia,
    meta,
    answers,
    leadNome: params.leadNome,
  };

  if (step && step !== "concluido" && isHardcodedStep(step)) {
    return processarPasso(step, ctx);
  }

  if (pedeMenu) {
    return reenviarMenuTriagemInicial(ctx);
  }

  if (complete && !active) {
    const saudacao = params.isNovo || mensagemEhSaudacaoSimples(params.mensagem);
    if (saudacao) {
      return iniciarSaudacao(ctx);
    }
    return { handled: false };
  }

  const deveIniciar = params.isNovo || mensagemEhSaudacaoSimples(params.mensagem);
  if (deveIniciar) {
    return iniciarSaudacao(ctx);
  }

  return { handled: false };
}

type DynamicPlaybookRuntime = {
  definition: FlowEngineDefinition;
  source: "published_dynamic_flow";
};

async function carregarIdentidadeAgentePlaybook(
  supabase: SupabaseClient,
  agenteSlug: string
): Promise<HubAgenteIdentidadePlaybookRow | null> {
  const slug = agenteSlug.trim();
  if (!slug) return null;
  const { data, error } = await supabase
    .from("hub_agente_identidade")
    .select(AGENTE_IDENTIDADE_PLAYBOOK_SELECT)
    .eq("agente_slug", slug)
    .maybeSingle();
  if (error) {
    console.warn("[playbook-flow] falha ao carregar identidade do agente", {
      agente: slug,
      erro: error.message,
    });
    return null;
  }
  return (data as HubAgenteIdentidadePlaybookRow | null) ?? null;
}

async function responderPosConclusaoPlaybook(params: {
  telefone: string;
  instanceToken: string;
}): Promise<PlaybookProcessResult> {
  await enviarTexto(params.telefone, MSG_PLAYBOOK_POS_CONCLUSAO, params.instanceToken);
  return {
    handled: true,
    skipIa: true,
    step: "concluido",
    bloquearIa: true,
    motivo: "playbook_pos_conclusao",
  };
}

async function responderFluxoPlaybookIndisponivel(params: {
  telefone: string;
  instanceToken: string;
  bloquearIa: boolean;
}): Promise<PlaybookProcessResult> {
  await enviarTexto(params.telefone, MSG_PLAYBOOK_FLUXO_INDISPONIVEL, params.instanceToken);
  return {
    handled: true,
    skipIa: true,
    bloquearIa: params.bloquearIa,
    motivo: "playbook_fluxo_indisponivel",
  };
}

export async function carregarDynamicPlaybookRuntime(
  supabase: SupabaseClient,
  agenteSlug: string
): Promise<DynamicPlaybookRuntime | null> {
  const { data: agenteMeta, error: agenteMetaErr } = await supabase
    .from("hub_agente_identidade")
    .select("playbook_generated_at, playbook_object_path, playbook_public_url, playbook_source_hash")
    .eq("agente_slug", agenteSlug)
    .maybeSingle();

  if (agenteMetaErr || !agenteMeta) {
    console.warn("[playbook-flow] runtime load failed: agent meta", {
      agente: agenteSlug,
      motivo: agenteMetaErr ? "meta_query_error" : "meta_not_found",
      erro: agenteMetaErr?.message ?? null,
    });
    return null;
  }

  const loaded = await loadPublishedPlaybookRuntimeSource(supabase, agenteSlug, {
    playbook_generated_at:
      typeof agenteMeta.playbook_generated_at === "string" ? agenteMeta.playbook_generated_at : null,
    playbook_object_path:
      typeof agenteMeta.playbook_object_path === "string" ? agenteMeta.playbook_object_path : null,
    playbook_public_url:
      typeof agenteMeta.playbook_public_url === "string" ? agenteMeta.playbook_public_url : null,
    playbook_source_hash:
      typeof agenteMeta.playbook_source_hash === "string" ? agenteMeta.playbook_source_hash : null,
  });
  if (!loaded.ok) {
    console.warn("[playbook-flow] runtime load failed: bucket download", {
      agente: agenteSlug,
      motivo: loaded.reason,
      detalhe: loaded.detail ?? null,
      path: agenteMeta.playbook_object_path ?? null,
    });
    return null;
  }

  let markdownForFlow = loaded.rawMarkdown;
  let parsed = parsePlaybookFlowFromMarkdown(markdownForFlow);
  if (!parsed.ok && parsed.reason === "not_found") {
    const contextual = await aplicarFluxoEmpresaAoMarkdown(supabase, agenteSlug, markdownForFlow);
    if (contextual.ok) {
      console.info("[playbook-flow] runtime auto-generated flow from empresa context", {
        agente: agenteSlug,
        action: contextual.action,
        empresa: contextual.resumo.empresa_label,
        markdown_bytes: contextual.markdown.length,
      });
      markdownForFlow = contextual.markdown;
      parsed = parsePlaybookFlowFromMarkdown(markdownForFlow);
    } else {
      const ensured = await ensureMarkdownWithWhatsappFlow(markdownForFlow);
      if (ensured.ok) {
        console.info("[playbook-flow] runtime auto-adapted missing whatsapp flow block", {
          agente: agenteSlug,
          auto_appended_flow: ensured.auto_appended_flow,
          markdown_bytes: ensured.markdown.length,
        });
        markdownForFlow = ensured.markdown;
        parsed = parsePlaybookFlowFromMarkdown(markdownForFlow);
      } else {
        console.warn("[playbook-flow] runtime flow auto-fix failed", {
          agente: agenteSlug,
          contextual_error: contextual.error,
          template_errors: ensured.errors,
        });
      }
    }
  }
  if (!parsed.ok) {
    console.warn("[playbook-flow] runtime load failed: flow parse", {
      agente: agenteSlug,
      motivo: parsed.reason,
      errors: parsed.errors,
      markdown_bytes: markdownForFlow.length,
    });
    return null;
  }

  const validated = validatePlaybookFlowDefinition(parsed.definition);
  if (!validated.ok) {
    console.warn("[playbook-flow] runtime load failed: flow validate", {
      agente: agenteSlug,
      motivo: "validation_errors",
      errors: validated.errors,
    });
    return null;
  }

  return {
    definition: convertStructuredFlowToEngine(validated.definition),
    source: "published_dynamic_flow",
  };
}

function mapDynamicStepToContract(step: string | undefined): PlaybookStep | undefined {
  if (!step) return undefined;
  return step as PlaybookStep;
}

async function processarPlaybookInboundDynamic(params: {
  supabase: SupabaseClient;
  leadId: string;
  telefone: string;
  mensagem: string;
  menuChoiceId?: string | null;
  tipoMidia: string;
  agenteSlug: string;
  instanceToken: string;
  leadNome?: string | null;
  metadata: unknown;
  bloquearIaPosConclusao?: boolean;
}): Promise<PlaybookProcessResult> {
  const state = lerEstadoPlaybook(params.metadata);
  let meta = lerMetadata(params.metadata);

  if (state.complete && !mensagemEhSaudacaoSimples(params.mensagem)) {
    if (params.bloquearIaPosConclusao) {
      return responderPosConclusaoPlaybook({
        telefone: params.telefone,
        instanceToken: params.instanceToken,
      });
    }
    return { handled: false, motivo: "playbook_concluido_permitir_ia" };
  }

  const hybridIa = playbookHybridIaEnabled();

  if (!hybridIa) {
    return processarPlaybookInboundDynamicLegacy(params);
  }

  const flowStateInicial = simFlowStateFromPlaybookLead(state);

  const persistState = async (patch: {
    step?: string | null;
    answers?: Record<string, string>;
    active?: boolean;
    complete?: boolean;
    resetAnswers?: boolean;
  }) => {
    const persisted = await persistirEstado(params.supabase, params.leadId, meta, {
      step: patch.step ? (patch.step as PlaybookStep) : patch.step === null ? null : undefined,
      answers: patch.answers,
      active: patch.active,
      complete: patch.complete,
      resetAnswers: patch.resetAnswers,
    });
    meta = persisted;
  };

  const runtime = await carregarDynamicPlaybookRuntime(params.supabase, params.agenteSlug);
  if (!runtime) return { handled: false, motivo: "runtime_indisponivel" };

  const onStepComplete = async (stepId: string, answers: Record<string, string>) => {
    await aplicarConclusaoPassoDinamico(
      params.supabase,
      {
        leadId: params.leadId,
        telefone: params.telefone,
        leadNome: params.leadNome,
        agenteSlug: params.agenteSlug,
        instanceToken: params.instanceToken,
        definition: runtime.definition,
      },
      stepId,
      answers
    );

    switch (stepId) {
      case "complete_arquitetura":
        await atualizarLeadPlaybook(params.supabase, params.leadId, params.agenteSlug, {
          estagio: "qualificado",
          metadata: {
            fluxo_ativo: "fluxo_arquitetura",
            lead_kind: "cliente_projetos",
            potencial: "MEDIO",
            cidade_bairro_projeto: answers.arq_localizacao || null,
            wa_playbook_complete: true,
          },
        });
        break;
      case "complete_corretor_cliente":
        await atualizarLeadPlaybook(params.supabase, params.leadId, params.agenteSlug, {
          estagio: "qualificado",
          metadata: {
            fluxo_ativo: "fluxo1",
            lead_kind: "cliente_imobiliario",
            potencial: "ALTO",
            wa_playbook_complete: true,
          },
        });
        break;
      case "complete_proprietario":
        await atualizarLeadPlaybook(params.supabase, params.leadId, params.agenteSlug, {
          estagio: "qualificado",
          metadata: {
            fluxo_ativo: "fluxo2",
            lead_kind: "cliente_imobiliario",
            potencial: "MEDIO",
            cidade_bairro_imovel: answers.prop_localizacao || null,
            valor_imovel: answers.prop_valor || null,
            wa_playbook_complete: true,
          },
        });
        break;
      case "complete_parceria":
        if (answers.parc_email) {
          await atualizarLeadPlaybook(params.supabase, params.leadId, params.agenteSlug, {
            email: answers.parc_email,
          });
        }
        await atualizarLeadPlaybook(params.supabase, params.leadId, params.agenteSlug, {
          estagio: "qualificado",
          metadata: {
            fluxo_ativo: "fluxo3",
            lead_kind: "imobiliaria_corretor",
            potencial: "MEDIO",
            wa_playbook_complete: true,
          },
        });
        break;
      case "complete_outro":
        await atualizarLeadPlaybook(params.supabase, params.leadId, params.agenteSlug, {
          metadata: {
            fluxo_ativo: "outro",
            caracteristicas_adicionais: answers.outro_descricao || null,
            wa_playbook_complete: true,
          },
        });
        break;
      default:
        break;
    }
  };

  const avancado = await avancarEstadoFluxoPlaybookWhatsapp({
    supabase: params.supabase,
    agenteSlug: params.agenteSlug,
    mensagemUsuario: params.mensagem,
    menuChoiceId: params.menuChoiceId,
    tipoMidia: params.tipoMidia,
    flowState: flowStateInicial,
    persistState,
    onNameCaptured: async (name) => {
      await atualizarLeadPlaybook(params.supabase, params.leadId, params.agenteSlug, { nome: name });
    },
    onStepComplete,
  });

  if (!avancado) return { handled: false, motivo: "runtime_indisponivel" };

  const { data: agenteApresentacao } = await params.supabase
    .from("hub_agente_identidade")
    .select("nome, tenant_id")
    .eq("agente_slug", params.agenteSlug)
    .maybeSingle();
  const nomeAgenteFluxo =
    (typeof agenteApresentacao?.nome === "string" && agenteApresentacao.nome.trim()) ||
    params.agenteSlug;
  const tenantIdFluxo =
    (typeof agenteApresentacao?.tenant_id === "string" && agenteApresentacao.tenant_id.trim()) ||
    defaultTenantId();
  const { cadastral: cadastralFluxo, nome_exibicao: nomeExibicaoFluxo } =
    await lerEmpresaCadastralTenant(params.supabase, tenantIdFluxo);
  const nomeEmpresaFluxo = nomeComercialEmpresa(cadastralFluxo, nomeExibicaoFluxo);

  const flowContext = buildBlocoContextoFluxoParaLlm(
    avancado.definition,
    avancado.flowState,
    params.mensagem,
    playbookMenuUazapiEnhancementEnabled(),
    undefined,
    { nomeAgente: nomeAgenteFluxo, nomeEmpresa: nomeEmpresaFluxo || undefined }
  );

  const pendingMenuRaw =
    playbookMenuUazapiEnhancementEnabled() && avancado.pendingMenu
      ? avancado.pendingMenu
      : undefined;
  const flowAnswers = avancado.flowState.answers ?? {};
  const pendingMenu =
    pendingMenuRaw &&
    deveAnexarMenuTriagemAutomatico({
      metadata: params.metadata,
      mensagem: params.mensagem,
      isNovo: false,
      flowAnswers,
    })
      ? { ...pendingMenuRaw, footerText: nomeEmpresaFluxo || pendingMenuRaw.footerText }
      : undefined;

  return {
    handled: true,
    skipIa: false,
    step: mapDynamicStepToContract(avancado.flowState.step ?? undefined),
    motivo: "dynamic_flow_hybrid_ia",
    flowContext,
    motor: "playbook_ia",
    pendingMenu,
  };
}

/** Modo legado: motor envia texto/menus fixos (skipIa=true). */
async function processarPlaybookInboundDynamicLegacy(params: {
  supabase: SupabaseClient;
  leadId: string;
  telefone: string;
  mensagem: string;
  menuChoiceId?: string | null;
  tipoMidia: string;
  agenteSlug: string;
  instanceToken: string;
  leadNome?: string | null;
  metadata: unknown;
  bloquearIaPosConclusao?: boolean;
}): Promise<PlaybookProcessResult> {
  const state = lerEstadoPlaybook(params.metadata);
  let meta = lerMetadata(params.metadata);

  if (state.complete && !mensagemEhSaudacaoSimples(params.mensagem)) {
    if (params.bloquearIaPosConclusao) {
      return responderPosConclusaoPlaybook({
        telefone: params.telefone,
        instanceToken: params.instanceToken,
      });
    }
    return { handled: false, motivo: "playbook_concluido_permitir_ia" };
  }

  const runtime = await carregarDynamicPlaybookRuntime(params.supabase, params.agenteSlug);
  if (!runtime) return { handled: false, motivo: "runtime_indisponivel" };

  // No modo dinâmico, o passo persistido deve ser retomado literalmente.
  // Alguns IDs do fluxo dinâmico podem coincidir com nomes legados (ex.: "arq_tamanho"),
  // então não podemos descartá-los com isHardcodedStep aqui.
  let flowStep = state.step && state.step !== "concluido" ? state.step : null;
  let flowAnswers =
    flowStep || state.active ? { ...state.answers } : state.complete ? { ...state.answers } : {};

  if (state.complete && mensagemEhSaudacaoSimples(params.mensagem)) {
    flowStep = null;
    flowAnswers = {};
  }

  const persistState = async (patch: {
    step?: string | null;
    answers?: Record<string, string>;
    active?: boolean;
    complete?: boolean;
    resetAnswers?: boolean;
  }) => {
    const persisted = await persistirEstado(params.supabase, params.leadId, meta, {
      step: patch.step ? (patch.step as PlaybookStep) : patch.step === null ? null : undefined,
      answers: patch.answers,
      active: patch.active,
      complete: patch.complete,
      resetAnswers: patch.resetAnswers,
    });
    meta = persisted;
  };

  if (state.complete && mensagemEhSaudacaoSimples(params.mensagem)) {
    await persistState({
      step: null,
      answers: {},
      active: true,
      complete: false,
      resetAnswers: true,
    });
  }

  const result = await executeFlowEngine(
    runtime.definition,
    {
      step: flowStep,
      answers: flowAnswers,
      mensagem: params.mensagem,
      menuChoiceId: params.menuChoiceId,
      tipoMidia: params.tipoMidia,
    },
    {
      sendText: async (text) => {
        await enviarTexto(params.telefone, text, params.instanceToken);
      },
      sendMedia: async ({ mediaType, file, caption }) =>
        enviarMedia(params.telefone, params.instanceToken, { mediaType, file, caption }),
      sendMenu: async ({ text, menuType, choices, listButton }) => {
        const footer = await rodapeMenuTenant(params.supabase, params.agenteSlug);
        const out = await enviarMenuUazapi({
          telefone: params.telefone,
          instanceToken: params.instanceToken,
          texto: text,
          tipo: menuType,
          choices,
          listButton,
          footerText: footer,
        });
        if (out.ok) {
          await marcarMenuTriagemEnviado(params.supabase, params.leadId);
        }
        const erro = out.ok ? undefined : "erro" in out ? out.erro : "falha_menu_uazapi";
        return { ok: out.ok, erro };
      },
      resolveChoiceId: resolverChoiceId,
      persistState,
      onNameCaptured: async (name) => {
        await atualizarLeadPlaybook(params.supabase, params.leadId, params.agenteSlug, { nome: name });
      },
      onStepComplete: async (stepId, answers) => {
        await aplicarConclusaoPassoDinamico(
          params.supabase,
          {
            leadId: params.leadId,
            telefone: params.telefone,
            leadNome: params.leadNome,
            agenteSlug: params.agenteSlug,
            instanceToken: params.instanceToken,
            definition: runtime.definition,
          },
          stepId,
          answers
        );

        switch (stepId) {
          case "complete_arquitetura":
            await atualizarLeadPlaybook(params.supabase, params.leadId, params.agenteSlug, {
              estagio: "qualificado",
              metadata: {
                fluxo_ativo: "fluxo_arquitetura",
                lead_kind: "cliente_projetos",
                potencial: "MEDIO",
                cidade_bairro_projeto: answers.arq_localizacao || null,
                wa_playbook_complete: true,
              },
            });
            break;
          case "complete_corretor_cliente":
            await atualizarLeadPlaybook(params.supabase, params.leadId, params.agenteSlug, {
              estagio: "qualificado",
              metadata: {
                fluxo_ativo: "fluxo1",
                lead_kind: "cliente_imobiliario",
                potencial: "ALTO",
                wa_playbook_complete: true,
              },
            });
            break;
          case "complete_proprietario":
            await atualizarLeadPlaybook(params.supabase, params.leadId, params.agenteSlug, {
              estagio: "qualificado",
              metadata: {
                fluxo_ativo: "fluxo2",
                lead_kind: "cliente_imobiliario",
                potencial: "MEDIO",
                cidade_bairro_imovel: answers.prop_localizacao || null,
                valor_imovel: answers.prop_valor || null,
                wa_playbook_complete: true,
              },
            });
            break;
          case "complete_parceria":
            if (answers.parc_email) {
              await atualizarLeadPlaybook(params.supabase, params.leadId, params.agenteSlug, {
                email: answers.parc_email,
              });
            }
            await atualizarLeadPlaybook(params.supabase, params.leadId, params.agenteSlug, {
              estagio: "qualificado",
              metadata: {
                fluxo_ativo: "fluxo3",
                lead_kind: "imobiliaria_corretor",
                potencial: "MEDIO",
                wa_playbook_complete: true,
              },
            });
            break;
          case "complete_outro":
            await atualizarLeadPlaybook(params.supabase, params.leadId, params.agenteSlug, {
              metadata: {
                fluxo_ativo: "outro",
                caracteristicas_adicionais: answers.outro_descricao || null,
                wa_playbook_complete: true,
              },
            });
            break;
          default:
            break;
        }
      },
    }
  );

  if (!result.handled) return result;
  return {
    handled: true,
    skipIa: result.skipIa,
    step: mapDynamicStepToContract(result.step),
    motivo: "dynamic_flow",
    motor: "playbook_flow",
  };
}

export async function processarPlaybookInbound(params: {
  supabase: SupabaseClient;
  leadId: string;
  telefone: string;
  mensagem: string;
  menuChoiceId?: string | null;
  tipoMidia: string;
  agenteSlug: string;
  instanceToken: string;
  isNovo: boolean;
  leadNome?: string | null;
  metadata: unknown;
}): Promise<PlaybookProcessResult> {
  if (!params.instanceToken.trim()) {
    return { handled: false, motivo: "sem_instance_token" };
  }

  const metaTenantId =
    params.metadata && typeof params.metadata === "object" && !Array.isArray(params.metadata)
      ? (params.metadata as Record<string, unknown>).tenant_id
      : null;
  const tenantId =
    typeof metaTenantId === "string" && metaTenantId.trim() ? metaTenantId.trim() : null;

  playbookPersistenciaCrm = {
    supabase: params.supabase,
    leadId: params.leadId,
    agenteSlug: params.agenteSlug,
    tenantId,
  };

  try {
  const ident =
    (await carregarIdentidadeAgentePlaybook(params.supabase, params.agenteSlug)) ?? {
      cargo: null,
      area: null,
      instrucao_modo: null,
      playbook_object_path: null,
      playbook_public_url: null,
    };
  const state = lerEstadoPlaybook(params.metadata);
  const routing = resolverRoteamentoPlaybookAgente({
    ident,
    playbookActive: state.active,
    playbookComplete: state.complete,
  });
  const agenteLegadoMari = agenteUsaPlaybookLegadoMari(params.agenteSlug);
  const temPlaybookPublicado =
    routing.temPlaybookPublicado || temReferenciaPlaybookPublicado(ident);

  if (dynamicFlowEnabled()) {
    try {
      const dynamicOut = await processarPlaybookInboundDynamic({
        supabase: params.supabase,
        leadId: params.leadId,
        telefone: params.telefone,
        mensagem: params.mensagem,
        menuChoiceId: params.menuChoiceId,
        tipoMidia: params.tipoMidia,
        agenteSlug: params.agenteSlug,
        instanceToken: params.instanceToken,
        leadNome: params.leadNome,
        metadata: params.metadata,
        bloquearIaPosConclusao: routing.bloquearIa,
      });
      if (dynamicOut.handled) {
        console.info("[playbook-flow] dynamic flow handled", {
          agente: params.agenteSlug,
          lead_id: params.leadId,
          step: dynamicOut.step ?? null,
          motivo: dynamicOut.motivo ?? null,
        });
        return {
          ...dynamicOut,
          bloquearIa:
            dynamicOut.skipIa === false && dynamicOut.flowContext?.trim()
              ? false
              : routing.bloquearIa || dynamicOut.bloquearIa,
        };
      }
      console.info("[playbook-flow] dynamic flow unavailable, fallback evaluation", {
        agente: params.agenteSlug,
        lead_id: params.leadId,
        motivo: dynamicOut.motivo ?? "definicao_ausente_ou_invalida",
      });
    } catch (err) {
      console.warn("[playbook-flow] dynamic flow failed, fallback evaluation", {
        erro: err instanceof Error ? err.message : String(err),
        agente: params.agenteSlug,
        lead_id: params.leadId,
      });
    }
  } else {
    console.info("[playbook-flow] dynamic flow disabled via env flag", {
      agente: params.agenteSlug,
      lead_id: params.leadId,
      flag: "PLAYBOOK_DYNAMIC_FLOW",
    });
  }

  if (temPlaybookPublicado) {
    console.warn("[playbook-flow] published playbook without executable flow", {
      agente: params.agenteSlug,
      lead_id: params.leadId,
      motivo: "fluxo_json_ausente_ou_invalido",
    });
    return responderFluxoPlaybookIndisponivel({
      telefone: params.telefone,
      instanceToken: params.instanceToken,
      bloquearIa: routing.bloquearIa,
    });
  }

  if (!agenteLegadoMari) {
    console.info("[playbook-flow] no legacy fallback for agent", {
      agente: params.agenteSlug,
      lead_id: params.leadId,
      motivo: "fallback_hardcoded_somente_mari",
    });
    return { handled: false, motivo: "sem_playbook_sem_legado" };
  }

  console.info("[playbook-flow] using legacy Mari hardcoded fallback", {
    agente: params.agenteSlug,
    lead_id: params.leadId,
  });
  return processarPlaybookInboundHardcoded(params);
  } finally {
    playbookPersistenciaCrm = null;
  }
}

/** @deprecated Use processarPlaybookInbound */
export const processarPlaybookMariaInbound = processarPlaybookInbound;
