/**
 * Gera bloco waje_playbook_flow a partir do contexto real do tenant/agente
 * (cargo, conhecimento, análise IA da base documental) — não usa template genérico de assistência.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentPlaybookSnapshotV1 } from "./agent-snapshot";
import { loadAgentPlaybookSnapshot } from "./agent-snapshot";
import type {
  PlaybookFlowDefinition,
  PlaybookFlowMenuOption,
  PlaybookFlowStep,
} from "./flow-definition-types";
import { validatePlaybookFlowDefinition } from "./flow-validate";
import { anexarFluxoDefinitionAoMarkdown } from "./playbook-flow-markdown";
import { lerAnaliseNegocioTenant } from "@/lib/hub/tenant-conhecimento-rag";
import { defaultTenantId } from "@/lib/tenant-default";

export type PlaybookFlowContextoResumo = {
  agente_slug: string;
  agente_nome: string;
  empresa_label: string;
  nicho: string | null;
  cargo_titulo: string | null;
  origem_menu: "analise_empresa" | "cargo_servicos" | "hibrido";
  opcoes_triagem: string[];
  perguntas_fluxo: number;
};

function slugId(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function textoSecao(conhecimento: Array<Record<string, unknown>>, secao: string): string {
  const row = conhecimento.find((r) => String(r.secao ?? "") === secao);
  return String(row?.conteudo ?? "").trim();
}

function splitLinesLite(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string") {
    return v
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  }
  return [];
}

function linhasBullet(texto: string, max = 4): string[] {
  return texto
    .split(/\n/)
    .map((l) => l.replace(/^[-*•\d.)]+\s*/, "").trim())
    .filter((l) => l.length >= 4 && l.length <= 80)
    .slice(0, max);
}

function corpusNegocio(parts: string[]): string {
  return parts.join(" ").toLowerCase();
}

type MenuInferido = { options: PlaybookFlowMenuOption[]; origem: PlaybookFlowContextoResumo["origem_menu"] };

function inferirOpcoesTriagem(params: {
  corpus: string;
  servicosTexto: string;
  nicho: string | null;
  segmentos: string[];
}): MenuInferido {
  const { corpus, servicosTexto, nicho, segmentos } = params;
  const opts: PlaybookFlowMenuOption[] = [];
  const usedLabels = new Set<string>();

  const push = (id: string, label: string, next: string, patch?: PlaybookFlowMenuOption["crm_patch"]) => {
    const lab = label.trim().slice(0, 72);
    if (!lab || usedLabels.has(lab.toLowerCase())) return;
    usedLabels.add(lab.toLowerCase());
    opts.push({
      id: slugId(id) || `opt_${opts.length + 1}`,
      label: lab,
      next,
      ...(patch ? { crm_patch: patch } : {}),
    });
  };

  const imob = /imobili|obra|arquitet|projeto|reforma|constru|incorpor|corretor/.test(corpus);
  const comercial = /comercial|vendas|orçamento|orcamento|produto|serviço|servico/.test(corpus);
  const suporte = /suporte|assist[eê]ncia|sac|pós-venda|pos-venda|técnico|tecnico/.test(corpus);

  if (imob) {
    push("triagem_imobiliario", "Imóveis (comprar ou anunciar)", "ramo_qualificacao_0", {
      interesse_principal: "imobiliario",
      fluxo_ativo: "imobiliario",
    });
    push("triagem_projetos", "Projetos e arquitetura", "ramo_qualificacao_0", {
      interesse_principal: "arquitetura",
      fluxo_ativo: "arquitetura",
    });
    push("triagem_orcamento", "Orçamento ou proposta", "ramo_qualificacao_0", {
      interesse_principal: "comercial",
      fluxo_ativo: "comercial",
    });
  } else if (comercial && !suporte) {
    push("triagem_comercial", "Conhecer produtos ou serviços", "ramo_qualificacao_0", {
      interesse_principal: "comercial",
      fluxo_ativo: "comercial",
    });
    push("triagem_orcamento", "Pedir orçamento", "ramo_qualificacao_0", {
      interesse_principal: "orcamento",
      fluxo_ativo: "comercial",
    });
  } else if (suporte) {
    push("triagem_suporte", "Preciso de ajuda / suporte", "ramo_suporte", {
      interesse_principal: "suporte",
      fluxo_ativo: "suporte",
    });
    push("triagem_comercial", "Quero contratar / saber mais", "ramo_qualificacao_0", {
      interesse_principal: "comercial",
      fluxo_ativo: "comercial",
    });
  }

  const bullets = linhasBullet(servicosTexto, 3);
  if (opts.length < 2 && bullets.length > 0) {
    bullets.forEach((b, i) => {
      push(`triagem_servico_${i + 1}`, b, "ramo_qualificacao_0", {
        interesse_principal: slugId(b).slice(0, 32) || "servico",
        fluxo_ativo: "comercial",
      });
    });
  }

  if (nicho && opts.length < 3) {
    const n = nicho.trim();
    if (n.length > 3 && !usedLabels.has(n.toLowerCase())) {
      push("triagem_nicho", `Sobre ${n}`, "ramo_qualificacao_0", {
        interesse_principal: slugId(n),
        fluxo_ativo: "comercial",
      });
    }
  }

  for (const seg of segmentos.slice(0, 2)) {
    if (opts.length >= 4) break;
    push(`triagem_seg_${slugId(seg)}`, seg, "ramo_qualificacao_0");
  }

  if (opts.length === 0) {
    push("triagem_info", "Informações sobre a empresa", "ramo_qualificacao_0", {
      fluxo_ativo: "comercial",
    });
    push("triagem_orcamento", "Orçamento ou proposta", "ramo_qualificacao_0", {
      fluxo_ativo: "comercial",
    });
  }

  push("triagem_humano", "Falar com atendente", "humano_motivo", {
    interesse_principal: "humano",
    fluxo_ativo: "handoff",
  });

  if (opts.length < 5) {
    push("triagem_outro", "Outro assunto", "outro_descricao");
  }

  const origem: PlaybookFlowContextoResumo["origem_menu"] =
    bullets.length > 0 && imob ? "hibrido" : bullets.length > 0 ? "cargo_servicos" : "analise_empresa";

  return { options: opts.slice(0, 5), origem };
}

export type PlaybookFlowAnaliseEmpresaInput = {
  nicho?: string | null;
  segmentos?: string[] | null;
  nome_empresa?: string | null;
  resumo?: string | null;
  produtos_servicos?: string[] | null;
};

export function buildPlaybookFlowFromSnapshot(
  snapshot: AgentPlaybookSnapshotV1,
  analiseEmpresa?: PlaybookFlowAnaliseEmpresaInput | null
): { definition: PlaybookFlowDefinition; resumo: PlaybookFlowContextoResumo } {
  const id = snapshot.identity ?? {};
  const cargo = snapshot.cargo_catalogo ?? {};
  const agenteNome = String(id.nome ?? snapshot.agente_slug).trim();
  const agenteSlug = snapshot.agente_slug;

  const empresaLabel =
    String(analiseEmpresa?.nome_empresa ?? "").trim() ||
    linhasBullet(textoSecao(snapshot.conhecimento, "empresa"), 1)[0]?.slice(0, 60) ||
    "nossa empresa";

  const nicho = String(analiseEmpresa?.nicho ?? "").trim() || null;
  const segmentos = Array.isArray(analiseEmpresa?.segmentos)
    ? analiseEmpresa!.segmentos!.map((s) => String(s).trim()).filter(Boolean)
    : [];

  const servicos = textoSecao(snapshot.conhecimento, "servicos");
  const atendimento = textoSecao(snapshot.conhecimento, "atendimento");

  const produtosAnalise = Array.isArray(analiseEmpresa?.produtos_servicos)
    ? analiseEmpresa!.produtos_servicos!.map((s) => String(s).trim()).filter(Boolean)
    : [];

  const corpus = corpusNegocio([
    String(cargo.titulo ?? ""),
    String(cargo.segmento ?? ""),
    String(cargo.especialidade ?? ""),
    String(cargo.descricao_curta ?? ""),
    nicho ?? "",
    ...segmentos,
    ...produtosAnalise,
    servicos.slice(0, 400),
    String(analiseEmpresa?.resumo ?? "").slice(0, 400),
  ]);

  const saudacaoCargo = String(cargo.saudacao_cliente ?? "").trim();
  const msgSaudacao = saudacaoCargo
    ? saudacaoCargo.replace(/\[Nome\]/g, agenteNome).split("\n")[0]!.slice(0, 220)
    : `Olá! Sou ${agenteNome}, da ${empresaLabel}. Como posso te ajudar hoje?`;

  const msgApresentacao =
    atendimento.split("\n").find((l) => l.trim().length > 10)?.trim().slice(0, 220) ||
    `Vou te acompanhar com base no que a ${empresaLabel} oferece — uma pergunta por vez.`;

  const perguntasCargo = splitLinesLite(cargo.perguntas_essenciais).filter(
    (p) => !/nome/i.test(p) || p.length > 40
  );

  const perguntas =
    perguntasCargo.length > 0
      ? perguntasCargo.slice(0, 5)
      : linhasBullet(servicos, 2).map((s) => `O que você busca em relação a ${s.toLowerCase()}?`).slice(0, 3);

  if (perguntas.length === 0) {
    perguntas.push("O que você busca no momento?", "Qual região ou contexto se aplica?");
  }

  const { options: menuOptions, origem } = inferirOpcoesTriagem({
    corpus,
    servicosTexto: servicos,
    nicho,
    segmentos,
  });

  const steps: PlaybookFlowStep[] = [
    {
      id: "inicio_saudacao",
      kind: "message",
      journey: "triagem",
      message: msgSaudacao.split("?")[0]!.includes("Olá") ? msgSaudacao : `Olá! ${msgSaudacao}`,
      next: "inicio_apresentacao",
    },
    {
      id: "inicio_apresentacao",
      kind: "message",
      journey: "triagem",
      message: msgApresentacao,
      next: "inicio_nome",
    },
    {
      id: "inicio_nome",
      kind: "input",
      journey: "triagem",
      prompt: "Qual é o seu nome, por gentileza?",
      field: "nome",
      input_type: "text",
      next: "agradecer_nome",
    },
    {
      id: "agradecer_nome",
      kind: "message",
      journey: "triagem",
      message: "Obrigado! É um prazer te atender.",
      next: "triagem_inicial_menu",
    },
    {
      id: "triagem_inicial_menu",
      kind: "menu",
      journey: "triagem",
      prompt: `Como posso te ajudar hoje com a ${empresaLabel}?`,
      field: "intencao_inicial",
      options: menuOptions,
    },
  ];

  let prevId = "ramo_qualificacao_0";
  perguntas.forEach((pergunta, idx) => {
    const stepId = `ramo_qualificacao_${idx}`;
    steps.push({
      id: stepId,
      kind: "input",
      journey: "vendas",
      prompt: pergunta,
      field: slugId(pergunta).slice(0, 32) || `campo_${idx}`,
      input_type: "text",
      next: idx < perguntas.length - 1 ? `ramo_qualificacao_${idx + 1}` : "ramo_encerramento",
    });
    if (idx === 0) {
      for (const opt of menuOptions) {
        if (opt.next === "ramo_qualificacao_0" || opt.next === prevId) {
          opt.next = stepId;
        }
      }
    }
    prevId = stepId;
  });

  steps.push({
    id: "ramo_encerramento",
    kind: "message",
    journey: "vendas",
    message: `Perfeito — registrei suas informações. O time da ${empresaLabel} retorna em breve por aqui.`,
    next: "ramo_complete",
  });

  steps.push({
    id: "ramo_complete",
    kind: "complete",
    journey: "vendas",
    complete: {
      type: "complete",
      handoff_to: "vendas",
      summary: `Lead qualificado (${empresaLabel}); contexto: ${nicho ?? cargo.titulo ?? "geral"}.`,
      crm_patch: {
        estagio: "qualificacao_inicial_concluida",
        potencial: "MEDIO",
        fluxo_ativo: "comercial",
      },
    },
  });

  steps.push({
    id: "ramo_suporte",
    kind: "input",
    journey: "suporte",
    prompt: "Descreva o que aconteceu para eu registrar corretamente.",
    field: "suporte_descricao",
    input_type: "text",
    next: "suporte_complete",
  });

  steps.push({
    id: "suporte_complete",
    kind: "complete",
    journey: "suporte",
    complete: {
      type: "complete",
      handoff_to: "suporte",
      summary: "Chamado de suporte registrado.",
      crm_patch: { fluxo_ativo: "suporte" },
    },
  });

  steps.push({
    id: "humano_motivo",
    kind: "input",
    journey: "triagem",
    prompt: "Em poucas palavras, qual assunto você quer tratar com o time?",
    field: "motivo_humano",
    input_type: "text",
    next: "humano_complete",
  });

  steps.push({
    id: "humano_complete",
    kind: "complete",
    journey: "triagem",
    complete: {
      type: "complete",
      handoff_to: "time_humano",
      summary: "Lead solicitou atendimento humano.",
      crm_patch: { fluxo_ativo: "handoff", lead_kind: "outro" },
    },
  });

  steps.push({
    id: "outro_descricao",
    kind: "input",
    journey: "triagem",
    prompt: "Conte em uma frase o que você precisa — vou encaminhar ao time certo.",
    field: "outro_assunto",
    input_type: "text",
    next: "outro_complete",
  });

  steps.push({
    id: "outro_complete",
    kind: "complete",
    journey: "triagem",
    complete: {
      type: "complete",
      handoff_to: "time_humano",
      summary: "Outro assunto — encaminhar com resumo.",
      crm_patch: { fluxo_ativo: "outro", lead_kind: "outro" },
    },
  });

  const definition: PlaybookFlowDefinition = {
    waje_playbook_flow_schema: 1,
    id: `waje_${slugId(agenteSlug) || "agente"}_ctx_v1`,
    version: "1.0.0",
    entry_step_id: "inicio_saudacao",
    journeys: ["triagem", "vendas", "suporte"],
    steps,
  };

  const validated = validatePlaybookFlowDefinition(definition);
  if (!validated.ok) {
    throw new Error(validated.errors.join("; "));
  }

  return {
    definition: validated.definition,
    resumo: {
      agente_slug: agenteSlug,
      agente_nome: agenteNome,
      empresa_label: empresaLabel,
      nicho,
      cargo_titulo: String(cargo.titulo ?? "").trim() || null,
      origem_menu: origem,
      opcoes_triagem: menuOptions.map((o) => o.label),
      perguntas_fluxo: perguntas.length,
    },
  };
}

export async function loadPlaybookFlowFromAgenteContext(
  supabase: SupabaseClient,
  agenteSlug: string
): Promise<
  | { ok: true; definition: PlaybookFlowDefinition; resumo: PlaybookFlowContextoResumo }
  | { ok: false; error: string }
> {
  const loaded = await loadAgentPlaybookSnapshot(supabase, agenteSlug);
  if ("error" in loaded) return { ok: false, error: loaded.error };

  const tenantId =
    (typeof loaded.snapshot.identity?.tenant_id === "string" && loaded.snapshot.identity.tenant_id.trim()) ||
    defaultTenantId();

  const analise = await lerAnaliseNegocioTenant(supabase, tenantId);
  const negocio = analise?.analise;

  try {
    const built = buildPlaybookFlowFromSnapshot(
      loaded.snapshot,
      negocio
        ? {
            nicho: negocio.nicho,
            segmentos: negocio.segmentos,
            nome_empresa: negocio.perfil_empresa || negocio.nicho,
            resumo: negocio.sintese,
            produtos_servicos: negocio.produtos_servicos,
          }
        : null
    );
    return { ok: true, definition: built.definition, resumo: built.resumo };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function aplicarFluxoEmpresaAoMarkdown(
  supabase: SupabaseClient,
  agenteSlug: string,
  narrativeMarkdown: string
): Promise<
  | {
      ok: true;
      markdown: string;
      action: "appended_flow" | "replaced_flow";
      resumo: PlaybookFlowContextoResumo;
      message: string;
    }
  | { ok: false; error: string }
> {
  const contextual = await loadPlaybookFlowFromAgenteContext(supabase, agenteSlug);
  if (!contextual.ok) return contextual;

  const opcoes = contextual.resumo.opcoes_triagem.join(", ");
  const msg = `Fluxo gerado para ${contextual.resumo.empresa_label}${
    contextual.resumo.nicho ? ` (${contextual.resumo.nicho})` : ""
  }. Triagem: ${opcoes}.`;

  const attached = anexarFluxoDefinitionAoMarkdown(narrativeMarkdown, contextual.definition, msg);
  if (!attached.ok) return { ok: false, error: attached.error };

  return {
    ok: true,
    markdown: attached.markdown,
    action: attached.action,
    resumo: contextual.resumo,
    message: attached.message,
  };
}
