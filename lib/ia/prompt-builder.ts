// ============================================================
// PROMPT BUILDER — Monta o prompt completo a partir do banco
// Zero alucinação — IA só usa o que foi configurado
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { HUB_MODELO_SENTINEL } from "./hub-model-defaults";
import { buscarTrechosRag } from "@/lib/hub/rag";

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
}

export interface PromptCompleto {
  systemPrompt: string;
  tokensEstimados: number;
  modelo: string;
  temperatura: number;
  agenteNome: string;
  fluxoAtual?: string;
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

  const { data: cargoCatalogo } = await supabase
    .from("hub_cargos_catalogo")
    .select(
      "slug,titulo,saudacao_cliente,usar_perguntas_essenciais,ordem_perguntas_essenciais,perguntas_essenciais,comprimento_padrao"
    )
    .eq("titulo", String(agente.cargo ?? ""))
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  // 2. Busca personalidade
  const { data: personalidade } = await supabase
    .from("hub_personalidade")
    .select("*")
    .eq("agente_slug", params.agenteSlug)
    .single();

  // 3. Busca memórias do lead (top 5 mais relevantes)
  let memorias: Array<{ chave: string; valor: string }> = [];
  if (params.leadId) {
    const { data: mems } = await supabase
      .from("hub_memorias_lead")
      .select("chave, valor, confianca")
      .eq("lead_id", params.leadId)
      .order("confianca", { ascending: false })
      .limit(5);
    if (mems) memorias = mems;
  }

  // 4. Busca regras de IA do agente
  const { data: regras } = await supabase
    .from("hub_regras_ia")
    .select("instrucao, prioridade")
    .eq("agente_slug", params.agenteSlug)
    .eq("ativo", true)
    .order("prioridade", { ascending: false });

  // 5. Seleciona modelo baseado no contexto
  const modelo = selecionarModelo(agente, params.mercado);

  // 6. Monta o prompt em camadas
  const secoes: string[] = [];

  // CAMADA 1 — IDENTIDADE
  const humorLabel = personalidade?.humor_label || "Profissional";
  const personalidadeLabel = personalidade?.personalidade_label || "Direto";
  const tomComunicacao = personalidade?.tom_comunicacao || "profissional";

  secoes.push(`═══ IDENTIDADE ═══
${agente.system_prompt_base}

COMPORTAMENTO: Humor ${humorLabel} + Personalidade ${personalidadeLabel}.
Tom de comunicação: ${tomComunicacao}.
${personalidade?.descricao_comportamento || ""}`);

  // CAMADA 2 — OPERAÇÃO DO CARGO (externo)
  if (cargoCatalogo) {
    const linhas: string[] = [];
    const saudacao = String(cargoCatalogo.saudacao_cliente ?? "").trim();
    const comprimentoPadrao = String(cargoCatalogo.comprimento_padrao ?? "").trim();
    const ordemPerguntas =
      cargoCatalogo.ordem_perguntas_essenciais === "final" ? "final" : "inicio";
    const perguntasEssenciais = splitLinesLite(cargoCatalogo.perguntas_essenciais);
    const usarPerguntas = cargoCatalogo.usar_perguntas_essenciais === true && perguntasEssenciais.length > 0;
    linhas.push("- Não mencionar cargo/função interna ao cliente (ex.: SDR, qualificador, closer).");
    linhas.push("- Fazer perguntas de qualificação naturalmente, sem anunciar processo interno.");
    if (saudacao) linhas.push(`- Saudação recomendada: "${saudacao}"`);
    if (comprimentoPadrao) linhas.push(`- Comprimento padrão: ${comprimentoPadrao}`);
    if (usarPerguntas) {
      linhas.push(
        `- Perguntas essenciais: aplicar no ${ordemPerguntas === "final" ? "final" : "início"} da conversa.`
      );
      linhas.push("- Lista em ordem preferencial:");
      for (const [idx, p] of perguntasEssenciais.entries()) linhas.push(`  ${idx + 1}. ${p}`);
    }
    secoes.push(`═══ OPERAÇÃO DO CARGO ═══\n${linhas.join("\n")}`);
  }

  // CAMADA 2.5 — RAG do agente (documentos anexados no wizard)
  if (params.mensagemAtual?.trim()) {
    const trechosRag = await buscarTrechosRag(supabase, params.agenteSlug, params.mensagemAtual, {
      limit: 4,
      threshold: 0.68,
    });
    if (trechosRag.length > 0) {
      const ragTexto = trechosRag
        .map((t, i) => {
          const conteudo = t.conteudo.length > 1_200 ? `${t.conteudo.slice(0, 1_200)}...` : t.conteudo;
          return `[Trecho ${i + 1} — ${t.nomeArquivo} — relevância ${t.similarity.toFixed(2)}]\n${conteudo}`;
        })
        .join("\n\n");
      secoes.push(`═══ DOCUMENTOS DO AGENTE (RAG) ═══
Use estes trechos quando forem relevantes para a pergunta atual. Se um trecho de documento conflitar com texto genérico de molde, priorize o documento; se não houver evidência suficiente, diga que vai verificar.

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

  // CAMADA 4 — REGRAS (toggles e configurações)
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

  // CAMADA 5 — MEMÓRIAS DO LEAD
  if (memorias.length > 0) {
    const memTexto = memorias.map(m => `• [${m.chave}] ${m.valor}`).join("\n");
    secoes.push(`═══ O QUE VOCÊ LEMBRA DESTE LEAD ═══\n${memTexto}`);
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
  ];
  if ((params.canal ?? "").toLowerCase() === "whatsapp") {
    regrasUniversais.unshift("Máximo 3 linhas por mensagem no WhatsApp — prefira 1 ou 2");
    regrasUniversais.push("Não mencionar cargo/função interna ao cliente (ex.: SDR, qualificador, closer).");
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
