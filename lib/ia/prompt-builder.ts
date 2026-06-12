// ============================================================
// PROMPT BUILDER — Monta o prompt completo a partir do banco
// Zero alucinação — IA só usa o que foi configurado
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { HUB_MODELO_SENTINEL } from "./hub-model-defaults";
import { buscarTrechosRag } from "@/lib/hub/rag";
import {
  buscarTrechosConhecimentoTenant,
  formatarAnaliseNegocioParaPrompt,
  formatarTrechosConhecimentoParaPrompt,
  lerAnaliseNegocioTenant,
} from "@/lib/hub/tenant-conhecimento-rag";
import { defaultTenantId } from "@/lib/tenant-default";
import { formatarBlocoMemoriasAgente, listarMemoriasAgente } from "@/lib/ia/memoria-agente";
import { blocoFluxoPrimeiroAtendimentoWhatsapp } from "@/lib/ia/primeiro-atendimento-whatsapp";
import { blocoRegrasFluxoSequencialPlaybook } from "@/lib/ia/playbook-mari-runtime";
import { cutoffSessaoConversaMs } from "@/lib/ia/sessao-conversa-ttl";
import { resolverCargoCatalogoParaAgente } from "@/lib/hub/resolver-cargo-catalogo";
import {
  blocoPerguntasEssenciaisCargo,
  obterProximaPerguntaEssencial,
  substituirPlaceholdersSaudacao,
  type TurnoMinimo,
} from "@/lib/ia/perguntas-essenciais-cargo";
import {
  deveUsarCargoCatalogoNoPrompt,
  isPlaybookOnlyAgent,
} from "@/lib/hub/agente-instrucao-modo";
import { loadPublishedPlaybookRuntimeSource } from "@/lib/playbook/published-runtime";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function splitLinesLite(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string") {
    return v
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export interface PromptParams {
  agenteSlug: string;
  leadId?: string;
  mercado?: string;
  etapaFluxo?: string;
  mensagemAtual?: string;
  canal?: string;
  /** Quantidade de turnos anteriores na conversa (0 = primeiro contacto). */
  turnosAnteriores?: number;
  /** Histórico para calcular próxima pergunta essencial do cargo (sem expor lista completa ao modelo). */
  turnosConversa?: TurnoMinimo[];
  /** Sessão reiniciada após TTL — tratar como primeiro contacto (Mari: nome + menu). */
  sessaoReiniciada?: boolean;
}

export interface PromptCompleto {
  systemPrompt: string;
  tokensEstimados: number;
  modelo: string;
  temperatura: number;
  agenteNome: string;
  fluxoAtual?: string;
  /** Playbook no bucket hub-agent-playbooks (ex.: maria.md). */
  playbookPublicado?: boolean;
}

export async function construirPrompt(params: PromptParams): Promise<PromptCompleto | null> {
  const supabase = db();

  // 1. Busca identidade do agente
  const { data: agente } = await supabase
    .from("hub_agente_identidade")
    .select("*")
    .eq("agente_slug", params.agenteSlug)
    .eq("ativo", true)
    .single();

  if (!agente) return null;

  const playbookPublicado = await loadPublishedPlaybookRuntimeSource(supabase, params.agenteSlug, {
    playbook_generated_at: typeof agente.playbook_generated_at === "string" ? agente.playbook_generated_at : null,
    playbook_object_path: typeof agente.playbook_object_path === "string" ? agente.playbook_object_path : null,
    playbook_public_url: typeof agente.playbook_public_url === "string" ? agente.playbook_public_url : null,
    playbook_source_hash: typeof agente.playbook_source_hash === "string" ? agente.playbook_source_hash : null,
  });
  const usarPlaybookPublicado = playbookPublicado.ok;
  const playbookOnly = isPlaybookOnlyAgent({
    cargo: agente.cargo as string | null,
    playbook_object_path: typeof agente.playbook_object_path === "string" ? agente.playbook_object_path : null,
    playbook_public_url: typeof agente.playbook_public_url === "string" ? agente.playbook_public_url : null,
  });

  const cargoCatalogo = deveUsarCargoCatalogoNoPrompt(
    { cargo: agente.cargo as string | null },
    usarPlaybookPublicado
  )
    ? await resolverCargoCatalogoParaAgente(supabase, {
        cargo: agente.cargo as string | null,
      })
    : null;

  // 2. Busca personalidade
  const { data: personalidade } = usarPlaybookPublicado
    ? { data: null }
    : await supabase.from("hub_personalidade").select("*").eq("agente_slug", params.agenteSlug).single();

  // 3. Busca memórias do lead (top 5) e do agente (top 6)
  let memorias: Array<{ chave: string; valor: string }> = [];
  let memoriasAgenteTexto = "";
  if (params.leadId && !params.sessaoReiniciada) {
    const cutoffIso = new Date(cutoffSessaoConversaMs()).toISOString();
    const { data: mems } = await supabase
      .from("hub_memorias_lead")
      .select("chave, valor, confianca")
      .eq("lead_id", params.leadId)
      .gte("criado_em", cutoffIso)
      .order("confianca", { ascending: false })
      .limit(5);
    if (mems) memorias = mems;
  }
  try {
    const memAgente = await listarMemoriasAgente(supabase, params.agenteSlug, 6);
    memoriasAgenteTexto = formatarBlocoMemoriasAgente(memAgente);
  } catch {
    memoriasAgenteTexto = "";
  }

  // 4. Busca regras de IA do agente
  const { data: regras } = usarPlaybookPublicado
    ? { data: null }
    : await supabase
        .from("hub_regras_ia")
        .select("instrucao, prioridade")
        .eq("agente_slug", params.agenteSlug)
        .eq("ativo", true)
        .order("prioridade", { ascending: false });

  // 5. Seleciona modelo baseado no contexto
  const modelo = selecionarModelo(agente, params.mercado);

  // 6. Monta o prompt em camadas
  const secoes: string[] = [];

  // CAMADA 1 — FONTE PRINCIPAL ESTÁTICA
  if (usarPlaybookPublicado) {
    secoes.push(`═══ PLAYBOOK PUBLICADO (FONTE PRINCIPAL) ═══
Siga o conteúdo abaixo como a fonte principal das instruções estáticas deste agente.
Origem publicada: ${playbookPublicado.path}
Modo de extração: ${playbookPublicado.mode}
${playbookOnly ? "Modo playbook-only: este agente não usa catálogo de cargo — ignore qualquer regra externa de SDR/cargo." : "Se alguma configuração genérica do runtime conflitar com este playbook, priorize o playbook publicado."}

${playbookPublicado.prompt}`);

    secoes.push(`═══ REGRAS DE NOME (CRÍTICO) ═══
- Nunca use nomes de rodapé, responsável técnico ou metadados do documento do playbook como nome do cliente.
- Os marcadores [Nome] nos exemplos do playbook são modelos — não são o nome real de quem está a escrever agora.
- Se o cliente só disse «Olá», «Oi» ou equivalente e ainda não confirmou o nome nesta conversa, NÃO invente nem assuma um nome na saudação.
- Siga o playbook: apresente a Mari, acolha e pergunte o nome («Me fale qual é o seu nome, por gentileza?») antes de personalizar.
- Só use nome na saudação se vier confirmado em «DADOS DO CANAL (WhatsApp → CRM)» para este número ou se o cliente tiver dito o nome nesta sessão.`);

    secoes.push(blocoRegrasFluxoSequencialPlaybook(playbookPublicado.flowHints));

    const tomWizard = String(agente.personalidade ?? "").trim();
    if (tomWizard) {
      secoes.push(`═══ TOM E ESTILO (complementar ao playbook) ═══\n${tomWizard}`);
    }

    // Fluxo determinístico no inbound pode enviar menus antes da IA; ver inbound-message-processor + menu-triagem-uazapi.
  } else {
    const tomWizard = String(agente.personalidade ?? "").trim();
    if (tomWizard) {
      secoes.push(`═══ IDENTIDADE ═══
${agente.system_prompt_base}

═══ TOM E ESTILO ═══
${tomWizard}`);
    } else {
      const humorLabel = personalidade?.humor_label || "Profissional";
      const personalidadeLabel = personalidade?.personalidade_label || "Direto";
      const tomComunicacao = personalidade?.tom_comunicacao || "profissional";

      secoes.push(`═══ IDENTIDADE ═══
${agente.system_prompt_base}

COMPORTAMENTO: Humor ${humorLabel} + Personalidade ${personalidadeLabel}.
Tom de comunicação: ${tomComunicacao}.
${personalidade?.descricao_comportamento || ""}`);
    }
  }

  const turnosAnteriores = params.sessaoReiniciada
    ? 0
    : Math.max(0, params.turnosAnteriores ?? 0);
  const conversaEmAndamento = turnosAnteriores > 0;
  const canalWhatsapp = (params.canal ?? "").toLowerCase() === "whatsapp";

  const turnosConversa = params.turnosConversa ?? [];
  const ordemPerguntasCargo =
    cargoCatalogo?.ordem_perguntas_essenciais === "final" ? "final" : "inicio";
  const perguntasEssenciaisCargo = cargoCatalogo
    ? splitLinesLite(cargoCatalogo.perguntas_essenciais)
    : [];
  const usarPerguntasCargo =
    cargoCatalogo?.usar_perguntas_essenciais === true && perguntasEssenciaisCargo.length > 0;

  const proximaPerguntaEssencial = usarPerguntasCargo
    ? obterProximaPerguntaEssencial(perguntasEssenciaisCargo, turnosConversa, ordemPerguntasCargo)
    : null;

  if (canalWhatsapp && !usarPerguntasCargo) {
    secoes.push(
      blocoFluxoPrimeiroAtendimentoWhatsapp(turnosAnteriores, {
        playbookPublicado: usarPlaybookPublicado,
      })
    );
  }

  if (params.sessaoReiniciada && canalWhatsapp) {
    secoes.push(`═══ NOVA SESSÃO (INACTIVIDADE) ═══
Passou o prazo sem mensagens deste lead. Trate como **primeiro contacto** nesta conversa:
- Não retome assuntos antigos (imóveis, orçamentos ou fluxos anteriores) salvo se o cliente mencionar agora.
- Siga o POP: saudação, pedir nome se faltar, menu de triagem quando aplicável.`);
  }

  // CAMADA 2 — EXECUÇÃO DESTE TURNO (só com catálogo de cargo, sem playbook publicado)
  if (cargoCatalogo && !usarPlaybookPublicado) {
    const linhas: string[] = [];
    const saudacao = String(cargoCatalogo.saudacao_cliente ?? "").trim();
    const comprimentoPadrao = String(cargoCatalogo.comprimento_padrao ?? "").trim();
    const nomeAgente = String(agente.nome ?? params.agenteSlug);

    if (usarPlaybookPublicado) {
      linhas.push(
        "- Esta camada só ajusta a execução deste turno com base no canal, histórico e próxima pergunta operacional."
      );
    } else {
      linhas.push("- Não mencionar cargo/função interna ao cliente (ex.: SDR, qualificador, closer).");
      linhas.push("- Fazer perguntas de qualificação naturalmente, sem anunciar processo interno.");
    }

    if (usarPerguntasCargo) {
      if (!conversaEmAndamento) {
        linhas.push(
          "- **Prioridade na 1ª mensagem:** use a saudação e a pergunta obrigatória desta camada; não substitua por cumprimento genérico («Olá! Tudo certo? Como posso ajudar?»)."
        );
      }
      linhas.push(
        ...blocoPerguntasEssenciaisCargo({
          usarPerguntas: true,
          perguntas: perguntasEssenciaisCargo,
          ordem: ordemPerguntasCargo,
          saudacao: saudacao || undefined,
          nomeAgente,
          comprimentoPadrao: comprimentoPadrao || undefined,
          conversaEmAndamento,
          proximaPergunta: proximaPerguntaEssencial,
        })
      );
    } else if (conversaEmAndamento) {
      linhas.push("- CONVERSA JÁ INICIADA: não repita saudação, não se reapresente.");
      linhas.push("- Responda direto ao que o cliente acabou de dizer; no máximo UMA pergunta nova por mensagem.");
    } else {
      if (saudacao) {
        linhas.push(
          `- Saudação (só na 1ª mensagem): «${substituirPlaceholdersSaudacao(saudacao, nomeAgente)}»`
        );
      }
      if (comprimentoPadrao) linhas.push(`- Comprimento padrão: ${comprimentoPadrao}`);
    }

    if (canalWhatsapp && usarPerguntasCargo) {
      linhas.push(
        "- WhatsApp: máximo 2 frases curtas; uma pergunta por mensagem; avance como na simulação interna do CRM."
      );
    }

    secoes.push(`═══ EXECUÇÃO DESTE TURNO ═══\n${linhas.join("\n")}`);
  }

  const tenantId =
    (typeof agente.tenant_id === "string" && agente.tenant_id.trim()) || defaultTenantId();

  // CAMADA 2.4 — Base de conhecimento da empresa (todos os agentes do tenant)
  const { count: docsConhecimentoProntos } = await supabase
    .from("hub_tenant_conhecimento_documento")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "pronto");

  const analiseEmpresa =
    (docsConhecimentoProntos ?? 0) > 0
      ? await lerAnaliseNegocioTenant(supabase, tenantId)
      : null;
  if (analiseEmpresa?.analise) {
    const perfilEmpresa = formatarAnaliseNegocioParaPrompt(analiseEmpresa.analise);
    if (perfilEmpresa) {
      secoes.push(`═══ PERFIL DA EMPRESA (CONHECIMENTO) ═══
Contexto consolidado da base de conhecimento do negócio (CRM → Conhecimento). Use para nicho, serviços, público e tom — não invente além disto.

${perfilEmpresa}`);
    }
  }

  const mensagemConsulta = params.mensagemAtual?.trim() ?? "";
  if (mensagemConsulta) {
    let trechosEmpresa = await buscarTrechosConhecimentoTenant(supabase, tenantId, mensagemConsulta, {
      limit: 5,
      threshold: 0.65,
    });
    if (trechosEmpresa.length === 0) {
      trechosEmpresa = await buscarTrechosConhecimentoTenant(supabase, tenantId, mensagemConsulta, {
        limit: 4,
        threshold: 0.55,
      });
    }
    if (trechosEmpresa.length > 0) {
      secoes.push(`═══ DOCUMENTOS DA EMPRESA (CONHECIMENTO) ═══
Fonte principal para fatos do negócio (produtos, preços, políticas, garantias, horários, POPs gerais).
Se estes trechos conflitarem com playbook genérico ou documentos só deste agente, **priorize a empresa**.
Se não houver evidência suficiente, diga que vai verificar — nunca invente.

${formatarTrechosConhecimentoParaPrompt(trechosEmpresa)}`);
    }
  }

  // CAMADA 2.5 — RAG específico do agente (documentos anexados no wizard)
  if (mensagemConsulta) {
    let trechosRag = await buscarTrechosRag(supabase, params.agenteSlug, mensagemConsulta, {
      limit: 4,
      threshold: 0.68,
    });
    // Fallback: em perguntas curtas/ambíguas, reduz threshold para não perder contexto útil.
    if (trechosRag.length === 0) {
      trechosRag = await buscarTrechosRag(supabase, params.agenteSlug, mensagemConsulta, {
        limit: 3,
        threshold: 0.56,
      });
    }
    if (trechosRag.length > 0) {
      const ragTexto = trechosRag
        .map((t, i) => {
          const conteudo = t.conteudo.length > 1_200 ? `${t.conteudo.slice(0, 1_200)}...` : t.conteudo;
          return `[Trecho ${i + 1} — ${t.nomeArquivo} — relevância ${t.similarity.toFixed(2)}]\n${conteudo}`;
        })
        .join("\n\n");
      secoes.push(`═══ DOCUMENTOS DESTE AGENTE (RAG ESPECÍFICO) ═══
Material específico desta função (scripts, checklists, manuais exclusivos). Para fatos gerais do negócio, priorize «DOCUMENTOS DA EMPRESA» acima.
Use estes trechos para procedimentos da função; se conflitar com a empresa em preço/política/serviço, priorize a empresa.

${ragTexto}`);
    }
  }

  // CAMADA 3 — MERCADO ATUAL
  if (params.mercado && params.mercado !== "geral") {
    const mercadoLabels: Record<string, string> = {
      imobiliario: "🏠 Imobiliário",
      arquitetura: "🏛 Arquitetura",
      reforma: "🔨 Reforma",
      fornecedor: "🤝 Fornecedor/Serviço",
      produto: "📦 Produto",
    };
    secoes.push(`═══ MERCADO ATUAL: ${mercadoLabels[params.mercado] || params.mercado} ═══
Você está atendendo um lead do segmento ${params.mercado}.
Adapte sua linguagem e conhecimento para este contexto específico.`);
  }

  // CAMADA 4 — REGRAS (fallback quando ainda não existe playbook publicado)
  if (!usarPlaybookPublicado) {
    const naoPodeFazer = (agente.nao_pode_fazer as string[]) || [];
    const sempreDizer = (agente.sempre_dizer as string[]) || [];
    const nuncaDizer = (agente.nunca_dizer as string[]) || [];

    let regrasTexto = "";
    if (naoPodeFazer.length > 0) {
      regrasTexto += `VOCÊ NUNCA PODE:\n${naoPodeFazer.map(r => `• ${r.replace(/_/g, " ")}`).join("\n")}`;
    }
    if (sempreDizer.length > 0) {
      regrasTexto += `\n\nSEMPRE USAR:\n${sempreDizer.map(r => `• "${r}"`).join("\n")}`;
    }
    if (nuncaDizer.length > 0) {
      regrasTexto += `\n\nNUNCA DIZER:\n${nuncaDizer.map(r => `• "${r}"`).join("\n")}`;
    }
    if (regras && regras.length > 0) {
      regrasTexto += `\n\nREGRAS ESPECÍFICAS:\n${regras.map(r => `• ${r.instrucao}`).join("\n")}`;
    }
    if (regrasTexto) secoes.push(`═══ REGRAS ═══\n${regrasTexto}`);
  }

  // CAMADA 5 — MEMÓRIAS DO LEAD
  if (memorias.length > 0) {
    const memTexto = memorias.map(m => `• [${m.chave}] ${m.valor}`).join("\n");
    secoes.push(`═══ O QUE VOCÊ LEMBRA DESTE LEAD ═══\n${memTexto}`);
  }

  if (memoriasAgenteTexto) {
    secoes.push(memoriasAgenteTexto);
  }

  // CAMADA 6 — ETAPA DO FLUXO
  if (params.etapaFluxo) {
    secoes.push(`═══ ETAPA ATUAL DO FLUXO ═══\n${params.etapaFluxo}`);
  }

  // CAMADA 7 — REGRAS UNIVERSAIS
  const regrasUniversais = [
    "Responda primeiro a pergunta do cliente, depois conduza",
    "Nunca mencione que é IA a menos que seja perguntado diretamente",
    "Se não souber, diga que vai verificar — nunca invente",
    "Nunca encerre sem indicar o próximo passo",
    "Para fatos do negócio (preço, garantia, horário, serviço), priorize DOCUMENTOS DA EMPRESA; use RAG deste agente só para procedimentos da função",
  ];
  if (usarPlaybookPublicado) {
    regrasUniversais.unshift("Considere o playbook publicado acima como a fonte principal das regras estáticas.");
  }
  if ((params.canal ?? "").toLowerCase() === "whatsapp") {
    regrasUniversais.unshift("Máximo 3 linhas por mensagem no WhatsApp — prefira 1 ou 2");
    regrasUniversais.push("Não mencionar cargo/função interna ao cliente (ex.: SDR, qualificador, closer).");
    if (conversaEmAndamento) {
      regrasUniversais.push(
        "Não repetir «Olá», «tudo bem?», nome da empresa ou «como posso ajudar» se já apareceu no histórico."
      );
      regrasUniversais.push("Avance o assunto: confirme o que entendeu e proponha o próximo passo concreto.");
    } else if (!usarPerguntasCargo) {
      regrasUniversais.push("Primeira mensagem: seja acolhedor e faça no máximo uma pergunta objetiva.");
    }
  }
  secoes.push(`═══ REGRAS UNIVERSAIS ═══\n${regrasUniversais.map((r) => `- ${r}`).join("\n")}`);

  const systemPrompt = secoes.join("\n\n");
  const tokensEstimados = Math.ceil(systemPrompt.length / 4);

  return {
    systemPrompt,
    tokensEstimados,
    modelo,
    temperatura: 0.7,
    agenteNome: agente.nome as string,
    fluxoAtual: params.etapaFluxo,
    playbookPublicado: usarPlaybookPublicado,
  };
}

function selecionarModelo(agente: Record<string, unknown>, mercado?: string): string {
  if (mercado === "imobiliario") {
    const m = (agente.modelo_critico as string)?.trim();
    return m || HUB_MODELO_SENTINEL;
  }
  const m = (agente.modelo_padrao as string)?.trim();
  return m || HUB_MODELO_SENTINEL;
}

export function estimarCusto(tokensEntrada: number, modelo: string): number {
  const taxas: Record<string, number> = {
    "claude-haiku-4-5-20251001": 0.00025,
    "claude-sonnet-4-6": 0.003,
    "claude-opus-4-7": 0.015,
    "mistral-small-latest": 0.0001,
    "mistral-large-latest": 0.002,
  };
  const m = modelo.toLowerCase();
  const heuristica =
    m.includes("opus")
      ? taxas["claude-opus-4-7"]
      : m.includes("sonnet")
        ? taxas["claude-sonnet-4-6"]
        : m.includes("haiku")
          ? taxas["claude-haiku-4-5-20251001"]
          : m.includes("mistral") || m.includes("mixtral") || m.includes("ministral")
            ? taxas["mistral-small-latest"]
            : taxas["claude-haiku-4-5-20251001"];
  const taxa = taxas[modelo] ?? heuristica;
  return parseFloat(((tokensEntrada / 1000) * taxa * 5.75).toFixed(4));
}
