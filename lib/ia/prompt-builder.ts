// ============================================================
// PROMPT BUILDER — Monta o prompt completo a partir do banco
// Zero alucinação — IA só usa o que foi configurado
// ============================================================
import { blocoDataHoraAtualParaAgente } from "@/lib/ia/bloco-data-hora-agente";
import { createClient } from "@supabase/supabase-js";
import { HUB_MODELO_SENTINEL } from "./hub-model-defaults";
import {
  formatarAnaliseNegocioParaPrompt,
  formatarTrechosConhecimentoParaPrompt,
  lerAnaliseNegocioTenant,
} from "@/lib/hub/tenant-conhecimento-rag";
import {
  formatarEmpresaCadastralParaPrompt,
  lerEmpresaCadastralTenant,
  nomeComercialEmpresa,
} from "@/lib/hub/tenant-empresa-cadastral";
import { defaultTenantId } from "@/lib/tenant-default";
import { formatarBlocoMemoriasAgente, listarMemoriasAgente } from "@/lib/ia/memoria-agente";
import { carregarNomeMemoriaLead, listarMemoriasLeadParaPrompt } from "@/lib/ia/memoria-lead";
import { blocoFluxoPrimeiroAtendimentoWhatsapp } from "@/lib/ia/primeiro-atendimento-whatsapp";
import { blocoRegrasFluxoSequencialPlaybook } from "@/lib/ia/playbook-mari-runtime";
import { agenteUsaPlaybookLegadoMari } from "@/lib/whatsapp/playbook-flow-runtime";
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
import {
  buscarContextoDocumentosAgenteParaPrompt,
  buscarContextoDocumentosEmpresaParaPrompt,
} from "@/lib/ia/contexto-documentos-prompt";
import { listarServicosCatalogo } from "@/lib/crm/servicos-catalogo";
import { formatarServicosCatalogoParaPrompt } from "@/lib/crm/servicos-catalogo-prompt";
import {
  formatarEstagiosPipelineParaPrompt,
  listarEstagiosPipelineParaIa,
} from "@/lib/crm/pipeline-estagios-ia";
import {
  blocoRaciocinioAtendimentoFluido,
  carregarContextoLeadCrmParaPrompt,
  clienteExpressouFrustracaoRepeticao,
  extrairResumoProblemaCliente,
  formatarBlocoContextoLeadCrm,
} from "@/lib/ia/atendimento-fluido";

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
  /** Contexto do roteiro WhatsApp (motor híbrido: passo + respostas, sem texto fixo). */
  blocoContextoFluxoPlaybook?: string;
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
  /** Quantidade de trechos RAG / catálogo injetados no prompt (diagnóstico). */
  contextoFontes?: {
    docsEmpresa: number;
    docsAgente: number;
    temCatalogo: boolean;
    temAnaliseEmpresa: boolean;
  };
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

  const nomeAgente = String(agente.nome ?? params.agenteSlug).trim() || params.agenteSlug;
  const tenantId =
    (typeof agente.tenant_id === "string" && agente.tenant_id.trim()) || defaultTenantId();
  const { cadastral: empresaCadastral, nome_exibicao: tenantNomeExibicao } =
    await lerEmpresaCadastralTenant(supabase, tenantId);
  const nomeEmpresaComercial = nomeComercialEmpresa(empresaCadastral, tenantNomeExibicao);
  const isMariLegado = agenteUsaPlaybookLegadoMari(params.agenteSlug);

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
  if (params.leadId) {
    const cutoffIso = params.sessaoReiniciada
      ? undefined
      : new Date(cutoffSessaoConversaMs()).toISOString();
    memorias = await listarMemoriasLeadParaPrompt(supabase, params.leadId, {
      cutoffIso,
      limit: 5,
    });
  }
  try {
    const memAgente = await listarMemoriasAgente(supabase, params.agenteSlug, 6);
    memoriasAgenteTexto = formatarBlocoMemoriasAgente(memAgente);
  } catch {
    memoriasAgenteTexto = "";
  }

  let contextoLeadCrm: Awaited<ReturnType<typeof carregarContextoLeadCrmParaPrompt>> = null;
  if (params.leadId) {
    try {
      contextoLeadCrm = await carregarContextoLeadCrmParaPrompt(supabase, params.leadId);
      const nomeMemoria = await carregarNomeMemoriaLead(supabase, params.leadId);
      if (contextoLeadCrm && nomeMemoria && nomeMemoria !== contextoLeadCrm.nome) {
        contextoLeadCrm = { ...contextoLeadCrm, nome: nomeMemoria };
      }
    } catch {
      contextoLeadCrm = null;
    }
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
  const turnosAnteriores = params.sessaoReiniciada
    ? 0
    : Math.max(0, params.turnosAnteriores ?? 0);
  const conversaEmAndamento = turnosAnteriores > 0;

  secoes.push(blocoDataHoraAtualParaAgente());

  // CAMADA 1 — FONTE PRINCIPAL ESTÁTICA
  if (usarPlaybookPublicado) {
    secoes.push(`═══ IDENTIDADE DESTE AGENTE (obrigatório) ═══
- Seu nome é **${nomeAgente}**. Nunca se apresente com outro nome de assistente do sistema.
- Sua função é exclusivamente a descrita no playbook abaixo — não misture papéis de outros agentes (ex.: SDR de triagem vs analista de CRM).
- Se o cliente perguntar o que você faz, responda conforme **este** playbook e cargo, não como outro assistente.`);

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
- Siga o playbook: apresente-se como **${nomeAgente}**, acolha e pergunte o nome quando o playbook exigir, antes de personalizar.
- Só use nome na saudação se vier confirmado em «DADOS DO CANAL (WhatsApp → CRM)» para este número ou se o cliente tiver dito o nome nesta sessão.`);

    if (!conversaEmAndamento && !(contextoLeadCrm?.nome && (params.sessaoReiniciada || contextoLeadCrm.evitarRepetirQualificacao))) {
      const empresaLabel = nomeEmpresaComercial || "nossa empresa";
      secoes.push(`═══ APRESENTAÇÃO NA 1ª MENSAGEM (obrigatório) ═══
- Você é **${nomeAgente}**, representando **${empresaLabel}**.
- Na primeira resposta: saudação + **seu nome (${nomeAgente})** + **empresa (${empresaLabel})** + pergunta do roteiro, sempre **por gentileza**.
- Exemplo de estrutura: «Olá! Sou ${nomeAgente}, da ${empresaLabel}. Qual é o seu nome, por gentileza?»
- **Proibido** responder só com o nome da empresa sem se identificar como ${nomeAgente}.
- **Proibido** pular para «Como posso te ajudar?» se o roteiro pede o nome do cliente primeiro.`);
    }

    if (isMariLegado) {
      secoes.push(blocoRegrasFluxoSequencialPlaybook(playbookPublicado.flowHints));
    } else if (playbookPublicado.flowHints?.trim()) {
      secoes.push(
        `═══ FLUXO DO PLAYBOOK (resumo deste agente) ═══\n${playbookPublicado.flowHints.trim()}`
      );
    } else {
      secoes.push(`═══ REGRAS DE FLUXO ═══
- Priorize **base de conhecimento + Mistral**; o playbook é guia, não script fixo.
- Responda primeiro ao pedido do cliente (link, reunião, preço) — **não** reenvie menu de triagem.
- hub_whatsapp_menu: só se activo no agente e **necessário** (triagem inicial ou 2–3 botões).
- Uma pergunta por mensagem quando estiver coletando dados.
- Não repita saudação nem menu já respondidos no histórico.`);
    }

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

  const canalWhatsapp = (params.canal ?? "").toLowerCase() === "whatsapp";

  const turnosConversa = params.turnosConversa ?? [];
  const ordemPerguntasCargo =
    cargoCatalogo?.ordem_perguntas_essenciais === "final" ? "final" : "inicio";
  const perguntasEssenciaisCargo = cargoCatalogo
    ? splitLinesLite(cargoCatalogo.perguntas_essenciais)
    : [];
  const usarPerguntasCargo =
    cargoCatalogo?.usar_perguntas_essenciais === true && perguntasEssenciaisCargo.length > 0;
  const evitarRepetirQualificacao = contextoLeadCrm?.evitarRepetirQualificacao === true;

  const proximaPerguntaEssencial = usarPerguntasCargo
    ? obterProximaPerguntaEssencial(perguntasEssenciaisCargo, turnosConversa, ordemPerguntasCargo, {
        evitarRepetirQualificacao,
      })
    : null;

  const frustracaoRepeticao = clienteExpressouFrustracaoRepeticao(turnosConversa);
  const resumoProblemaCliente = extrairResumoProblemaCliente(turnosConversa);

  if (canalWhatsapp) {
    secoes.push(blocoRaciocinioAtendimentoFluido(true));
  }

  if (contextoLeadCrm) {
    secoes.push(formatarBlocoContextoLeadCrm(contextoLeadCrm));
  }

  if (canalWhatsapp && !usarPerguntasCargo && isMariLegado) {
    secoes.push(
      blocoFluxoPrimeiroAtendimentoWhatsapp(turnosAnteriores, {
        playbookPublicado: usarPlaybookPublicado,
      })
    );
  }

  if (params.sessaoReiniciada && canalWhatsapp) {
    secoes.push(`═══ NOVA SESSÃO (INACTIVIDADE) ═══
Passou o prazo sem mensagens nesta conversa. Trate como **retorno** — não como lead novo:
- Use o bloco **CLIENTE NO CRM** e ferramentas **hub_lead_resumo** / **hub_atualizar_lead** antes de repetir perguntas.
- Só requalifique nome e dados se passou mais de uma semana sem contacto ou todos os negócios foram concluídos.
- Não retome assuntos antigos salvo se o cliente mencionar agora.`);
  }

  if (params.blocoContextoFluxoPlaybook?.trim()) {
    secoes.push(params.blocoContextoFluxoPlaybook.trim());
  }

  // CAMADA 2 — EXECUÇÃO DESTE TURNO (só com catálogo de cargo, sem playbook publicado)
  if (cargoCatalogo && !usarPlaybookPublicado) {
    const linhas: string[] = [];
    const saudacao = String(cargoCatalogo.saudacao_cliente ?? "").trim();
    const comprimentoPadrao = String(cargoCatalogo.comprimento_padrao ?? "").trim();

    if (usarPlaybookPublicado) {
      linhas.push(
        "- Esta camada só ajusta a execução deste turno com base no canal, histórico e próxima pergunta operacional."
      );
    } else {
      linhas.push("- Não mencionar cargo/função interna ao cliente (ex.: SDR, qualificador, closer).");
      linhas.push("- Fazer perguntas de qualificação naturalmente, sem anunciar processo interno.");
    }

    if (usarPerguntasCargo) {
      if (!conversaEmAndamento && !evitarRepetirQualificacao) {
        linhas.push(
          "- **1ª mensagem:** saudação curta do cargo; pergunte só o que o cliente ainda não disse (veja CRM e histórico)."
        );
      }
      linhas.push(
        ...blocoPerguntasEssenciaisCargo({
          usarPerguntas: true,
          perguntas: perguntasEssenciaisCargo,
          ordem: ordemPerguntasCargo,
          saudacao: saudacao || undefined,
          nomeAgente,
          nomeEmpresa: nomeEmpresaComercial || undefined,
          comprimentoPadrao: comprimentoPadrao || undefined,
          conversaEmAndamento,
          proximaPergunta: proximaPerguntaEssencial,
          evitarRepetirQualificacao,
        })
      );
    } else if (conversaEmAndamento) {
      linhas.push("- CONVERSA JÁ INICIADA: não repita saudação, não se reapresente.");
      linhas.push("- Responda direto ao que o cliente acabou de dizer; no máximo UMA pergunta nova por mensagem.");
    } else {
      if (saudacao) {
        linhas.push(
          `- Saudação (só na 1ª mensagem): «${substituirPlaceholdersSaudacao(saudacao, nomeAgente, nomeEmpresaComercial)}»`
        );
      }
      if (comprimentoPadrao) linhas.push(`- Comprimento padrão: ${comprimentoPadrao}`);
    }

    if (canalWhatsapp && usarPerguntasCargo) {
      linhas.push(
        "- WhatsApp: máximo 2 frases curtas; uma pergunta por mensagem — **somente** se faltar dado para avançar."
      );
    }

    if (frustracaoRepeticao) {
      linhas.push(
        "- O cliente indicou que **já respondeu**: peça desculpas em uma linha, **não** repita a pergunta, use o que ele disse e avance (orçamento/solução)."
      );
    }

    if (resumoProblemaCliente) {
      linhas.push(`- Problema/pedido já informado pelo cliente: «${resumoProblemaCliente}» — trate como dado confirmado.`);
    }

    if (conversaEmAndamento && !proximaPerguntaEssencial) {
      linhas.push(
        "- Qualificação essencial concluída ou cliente não pode informar dado opcional (ex.: IMEI): **passe ao orçamento ou próximo passo comercial** usando CATÁLOGO DE SERVIÇOS e DOCUMENTOS DA EMPRESA — não fique só em agendamento genérico se houver preço na base."
      );
    }

    secoes.push(`═══ EXECUÇÃO DESTE TURNO ═══\n${linhas.join("\n")}`);
  }

  // CAMADA 2.3 — Identidade cadastral da empresa (CNPJ / Conhecimento)
  if (empresaCadastral) {
    const blocoCadastral = formatarEmpresaCadastralParaPrompt(empresaCadastral, tenantNomeExibicao);
    if (blocoCadastral) {
      secoes.push(`═══ IDENTIDADE DA EMPRESA (CADASTRO CRM) ═══
${blocoCadastral}`);
    }
  }

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

  let docsEmpresaCount = 0;
  let docsAgenteCount = 0;
  let temCatalogo = false;

  const trechosEmpresa = await buscarContextoDocumentosEmpresaParaPrompt(supabase, tenantId, {
    mensagemAtual: params.mensagemAtual,
    turnosConversa: params.turnosConversa,
  });
  docsEmpresaCount = trechosEmpresa.length;
  if (trechosEmpresa.length > 0) {
    secoes.push(`═══ DOCUMENTOS DA EMPRESA (CONHECIMENTO) ═══
Fonte principal para fatos do negócio (produtos, preços, políticas, garantias, horários, POPs gerais).
Se estes trechos conflitarem com playbook genérico ou documentos só deste agente, **priorize a empresa**.
Se não houver evidência suficiente, diga que vai verificar — nunca invente.

${formatarTrechosConhecimentoParaPrompt(trechosEmpresa)}`);
  }

  // CAMADA 2.5 — RAG específico do agente (documentos anexados no wizard)
  const trechosRag = await buscarContextoDocumentosAgenteParaPrompt(supabase, params.agenteSlug, {
    mensagemAtual: params.mensagemAtual,
    turnosConversa: params.turnosConversa,
  });
  docsAgenteCount = trechosRag.length;
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

  // CAMADA 2.6 — Catálogo de serviços/preços (CRM)
  try {
    const catalogo = await listarServicosCatalogo(supabase, tenantId);
    const textoCatalogo = formatarServicosCatalogoParaPrompt(catalogo);
    if (textoCatalogo) {
      temCatalogo = true;
      secoes.push(`═══ CATÁLOGO DE SERVIÇOS E PREÇOS (CRM) ═══
Tabela oficial de referência do negócio. Use para orçamentos quando o cliente pedir valor, reparo ou serviço.
Cite valores **somente** daqui ou de DOCUMENTOS DA EMPRESA — nunca invente. Se não houver item exato, informe faixa ou diga que confirma na loja.
Quando o cliente **aceitar** orçamento ou pedir proposta formal, chame **hub_criar_negocio** com \`servico_nome\` e \`valor_estimado\` deste catálogo.

${textoCatalogo}`);
    }
  } catch {
    /* tabela opcional até migração aplicada */
  }

  // CAMADA 2.7 — Pipelines e estágios CRM (configuráveis por empresa)
  try {
    const estagiosLead = await listarEstagiosPipelineParaIa(supabase, tenantId, "lead");
    const textoPipelines = formatarEstagiosPipelineParaPrompt(estagiosLead);
    if (textoPipelines) {
      secoes.push(`═══ PIPELINES CRM — ESTÁGIOS COMERCIAIS (LEADS) ═══
Use estes slugs em **hub_atualizar_lead** quando mover o lead no funil.
Não use estágios de fechamento (ganho/perdido) — só humanos no CRM.

${textoPipelines}`);
    }
  } catch {
    /* pipelines opcionais */
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
    secoes.push(`═══ O QUE VOCÊ LEMBRA DESTE LEAD ═══
${memTexto}
- Se houver conflito entre nome no CRM e nome dito agora pelo cliente, **priorize o que o cliente acabou de dizer** e actualize o CRM.`);
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
    "Para fatos do negócio (preço, garantia, horário, serviço), priorize DOCUMENTOS DA EMPRESA e CATÁLOGO DE SERVIÇOS; use RAG deste agente só para procedimentos da função",
    "Quando o cliente pedir orçamento ou valor e houver preço na base, informe de forma clara (serviço + valor); não adie só por faltar dado opcional",
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
    contextoFontes: {
      docsEmpresa: docsEmpresaCount,
      docsAgente: docsAgenteCount,
      temCatalogo,
      temAnaliseEmpresa: Boolean(analiseEmpresa?.analise),
    },
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
