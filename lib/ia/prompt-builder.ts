// ============================================================
// PROMPT BUILDER — Monta o prompt completo a partir do banco
// Zero alucinação — IA só usa o que foi configurado
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { HUB_MODELO_SENTINEL } from "./hub-model-defaults";
import { ordemConhecimentoSecao } from "@/lib/hub/conhecimento-secoes";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export interface PromptParams {
  agenteSlug: string;
  leadId?: string;
  mercado?: string;
  etapaFluxo?: string;
  mensagemAtual?: string;
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

  // 2. Busca personalidade
  const { data: personalidade } = await supabase
    .from("hub_personalidade")
    .select("*")
    .eq("agente_slug", params.agenteSlug)
    .single();

  // 3. Busca conhecimento por seção (ordenado)
  const { data: conhecimentos } = await supabase
    .from("hub_agente_conhecimento")
    .select("*")
    .eq("agente_slug", params.agenteSlug)
    .eq("ativo", true)
    .order("ordem", { ascending: true })
    .order("secao");

  // 4. Busca memórias do lead (top 5 mais relevantes)
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

  // 5. Busca regras de IA do agente
  const { data: regras } = await supabase
    .from("hub_regras_ia")
    .select("instrucao, prioridade")
    .eq("agente_slug", params.agenteSlug)
    .eq("ativo", true)
    .order("prioridade", { ascending: false });

  // 6. Seleciona modelo baseado no contexto
  const modelo = selecionarModelo(agente, params.mercado);

  // 7. Monta o prompt em camadas
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

  // CAMADA 2 — CONTEXTO DO NEGÓCIO (conhecimento inserido por Wendel)
  if (conhecimentos && conhecimentos.length > 0) {
    const porSecao: Record<string, typeof conhecimentos> = {};
    for (const c of conhecimentos) {
      if (!porSecao[c.secao]) porSecao[c.secao] = [];
      porSecao[c.secao].push(c);
    }

    const secaoLabels: Record<string, string> = {
      fluxo_sdr: "NÚCLEO OPERACIONAL (POP)",
      empresa: "SOBRE O NEGÓCIO",
      servicos: "SERVIÇOS E PRODUTOS",
      atendimento: "COMO ATENDER",
      proibicoes: "NUNCA FAZER",
      exemplos: "EXEMPLOS REAIS",
      objeccoes: "COMO LIDAR COM OBJEÇÕES",
    };

    const secoesKeys = Object.keys(porSecao).sort(
      (a, b) => ordemConhecimentoSecao(a) - ordemConhecimentoSecao(b) || a.localeCompare(b)
    );
    for (const secao of secoesKeys) {
      const itens = porSecao[secao];
      const label = secaoLabels[secao] || secao.toUpperCase();
      const conteudo = itens.map(i => `[${i.titulo}]\n${i.conteudo}`).join("\n\n");
      secoes.push(`═══ ${label} ═══\n${conteudo}`);
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
  secoes.push(`═══ REGRAS UNIVERSAIS ═══
- Máximo 3 linhas por mensagem no WhatsApp — prefira 1 ou 2
- Responda primeiro a pergunta do cliente, depois conduza
- Nunca mencione que é IA a menos que seja perguntado diretamente
- Se não souber, diga que vai verificar — nunca invente
- Nunca encerre sem indicar o próximo passo`);

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
