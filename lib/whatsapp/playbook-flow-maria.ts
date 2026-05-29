/**
 * Fluxo determinístico WhatsApp — Playbook Unificado Maria (Obra10+).
 * Estado em hub_leads_crm.metadata: wa_playbook_step, wa_playbook_answers, wa_playbook_active.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildHubLeadsCrmPatch } from "@/lib/hub/hub-leads-crm-atualizar";
import {
  enviarMenuUazapi,
  marcarMenuTriagemEnviado,
  mensagemEhSaudacaoSimples,
  mensagemPedeMenuOuOpcoes,
} from "@/lib/whatsapp/menu-triagem-uazapi";
import { whatsappSendText } from "@/lib/whatsapp/whatsapp-send";

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

export type PlaybookProcessResult =
  | { handled: false }
  | { handled: true; skipIa: boolean; step?: PlaybookStep };

type PlaybookAnswers = Record<string, string>;

const FOOTER = "HUB Obra 10+";

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

export function agenteUsaPlaybookMaria(agenteSlug: string): boolean {
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
    const pipeId = t.includes("|") ? t.split("|")[1]?.trim() : "";
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
  }
): Promise<Record<string, unknown>> {
  const meta = { ...metaBase };
  if (patch.step !== undefined) {
    if (patch.step) meta.wa_playbook_step = patch.step;
    else delete meta.wa_playbook_step;
  }
  if (patch.answers) {
    const prev =
      meta.wa_playbook_answers && typeof meta.wa_playbook_answers === "object"
        ? { ...(meta.wa_playbook_answers as Record<string, string>) }
        : {};
    meta.wa_playbook_answers = { ...prev, ...patch.answers };
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
  await whatsappSendText(telefone, texto, { instanceToken });
}

async function enviarLista(
  telefone: string,
  instanceToken: string,
  texto: string,
  choices: string[],
  listButton = "Ver opções"
) {
  return enviarMenuUazapi({
    telefone,
    instanceToken,
    texto,
    tipo: "list",
    choices,
    listButton,
    footerText: FOOTER,
  });
}

async function enviarBotoes(telefone: string, instanceToken: string, texto: string, choices: string[]) {
  return enviarMenuUazapi({
    telefone,
    instanceToken,
    texto,
    tipo: "button",
    choices,
    footerText: FOOTER,
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
  const nome = (ctx.answers.nome || ctx.leadNome || "").trim();
  const intro =
    textoIntro?.trim() ||
    (nome
      ? `Obrigado, ${nome}! Para te orientar melhor, escolha uma opção abaixo:`
      : "Para te orientar melhor, escolha uma opção abaixo:");
  if (nome && !ctx.answers.nome) {
    await atualizarLeadPlaybook(ctx.supabase, ctx.leadId, ctx.agenteSlug, { nome });
    ctx.answers.nome = nome;
  }
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
    console.warn("[playbook-flow-maria] menu triagem falhou:", menu.erro);
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
        const nomeCrm = (ctx.leadNome || ctx.answers.nome || "").trim();
        if (nomeCrm) {
          return aposNomeEnviarTriagem(ctx, nomeCrm);
        }
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
          const nomeCrm = (ctx.leadNome || ctx.answers.nome || "").trim();
          if (nomeCrm) return aposNomeEnviarTriagem(ctx, nomeCrm);
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

export async function processarPlaybookMariaInbound(params: {
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
  if (!agenteUsaPlaybookMaria(params.agenteSlug)) {
    return { handled: false };
  }
  if (!params.instanceToken.trim()) {
    return { handled: false };
  }

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

  if (step && step !== "concluido") {
    return processarPasso(step, ctx);
  }

  if (pedeMenu) {
    return reenviarMenuTriagemInicial(ctx);
  }

  if (complete && !active) {
    const saudacao = params.isNovo || mensagemEhSaudacaoSimples(params.mensagem);
    if (saudacao) {
      const nomeCrm = (params.leadNome || answers.nome || "").trim();
      if (nomeCrm) {
        return aposNomeEnviarTriagem(ctx, nomeCrm);
      }
      return iniciarSaudacao(ctx);
    }
    return { handled: false };
  }

  const deveIniciar = params.isNovo || mensagemEhSaudacaoSimples(params.mensagem);
  if (deveIniciar) {
    const nomeCrm = (params.leadNome || answers.nome || "").trim();
    if (nomeCrm && mensagemEhSaudacaoSimples(params.mensagem)) {
      return aposNomeEnviarTriagem(ctx, nomeCrm);
    }
    return iniciarSaudacao(ctx);
  }

  return { handled: false };
}
