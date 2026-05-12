// ============================================================
// ENGINE v2 — Motor de IA Universal
// Integra: Router + Monitor + Aprovações + Storage
// ============================================================
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { receberDemanda, escalarDemanda, verificarAutonomia, carregarAgentePorSlug, type Demanda } from "./router";
import { criarAprovacao } from "./aprovacoes";
import { salvarConversa } from "./storage";
import { FLUXO_IMOBILIARIO, FLUXO_ARQUITETURA, MARI_CONFIG, identificarMercado, gerarSystemPromptCompleto } from "./agentes-config";
import { construirPrompt } from "./prompt-builder";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ── CACHE DE PROMPTS ──────────────────────────────────────────
const promptCache = new Map<string, { prompt: string; expira: number }>();

function obterPromptCacheado(chave: string, gerador: () => string): string {
  const agora = Date.now();
  const cached = promptCache.get(chave);
  if (cached && cached.expira > agora) return cached.prompt;
  const prompt = gerador();
  promptCache.set(chave, { prompt, expira: agora + 5 * 60 * 1000 });
  return prompt;
}

// ── TIPOS ─────────────────────────────────────────────────────
export interface ContextoMensagem {
  leadId: string;
  mensagem: string;
  canal: "whatsapp" | "instagram" | "email" | "interno" | "site";
  telefone?: string;
  nome?: string;
  segmento?: string;
  valorEstimado?: number;
  arquivos?: string[];
  metadata?: Record<string, unknown>;
  /** Se ativo no banco, usa este agente; caso contrário aplica o router. */
  agenteSlugHint?: string;
  tenantId?: string;
  /** Ex.: WhatsApp usa `pendente_envio` para alinhar à Evolution/outros emissores. */
  statusFilaSaida?: string;
}

export interface ResultadoEngine {
  sucesso: boolean;
  resposta?: string;
  agenteSlug?: string;
  agenteNome?: string;
  modelo?: string;
  tokens?: { entrada: number; saida: number };
  custo?: { usd: number; brl: number };
  latencia?: number;
  precisaAprovacao?: boolean;
  aprovacaoId?: string;
  erro?: string;
  logId?: string;
}

// ── PROCESSAMENTO PRINCIPAL ───────────────────────────────────
export async function processarMensagem(ctx: ContextoMensagem): Promise<ResultadoEngine> {
  const inicio = Date.now();
  const db = supabase();

  try {
    // ETAPA 1: Monta a demanda
    const demanda: Demanda = {
      tipo: "atendimento",
      canal: ctx.canal,
      mensagem: ctx.mensagem,
      leadId: ctx.leadId,
      segmento: ctx.segmento,
      valorEstimado: ctx.valorEstimado,
      contexto: ctx.metadata,
    };

    // ETAPA 2: Agente preferencial (ex.: mercado já mapeado no webhook) ou router
    const agente =
      (ctx.agenteSlugHint ? await carregarAgentePorSlug(ctx.agenteSlugHint, demanda) : null) ??
      (await receberDemanda(demanda));
    if (!agente) {
      return { sucesso: false, erro: "Nenhum agente disponível para esta demanda" };
    }

    // ETAPA 3: Verifica autonomia do agente
    const autonomia = await verificarAutonomia(
      agente.slug,
      ctx.mensagem,
      ctx.valorEstimado || 0
    );

    if (!autonomia.podeAgir) {
      const aprovacaoId = await criarAprovacao({
        tipo: "atendimento_critico",
        agenteSlug: agente.slug,
        descricao: `${agente.nome} precisa de aprovação para continuar`,
        motivo: autonomia.motivo,
        impacto: `Lead ${ctx.leadId} aguardando atendimento`,
        leadId: ctx.leadId,
        valorEnvolvido: ctx.valorEstimado,
        dados: { mensagem: ctx.mensagem, canal: ctx.canal },
      });

      return {
        sucesso: true,
        resposta: "Sua solicitação foi encaminhada para análise. Em breve retornaremos.",
        agenteSlug: agente.slug,
        precisaAprovacao: true,
        aprovacaoId: aprovacaoId || undefined,
      };
    }

    // ETAPA 4: Busca histórico recente (últimas 5 mensagens)
    const { data: historico } = await db
      .from("hub_fila_mensagens")
      .select("conteudo, direcao, criado_em")
      .eq("lead_id", ctx.leadId)
      .order("criado_em", { ascending: false })
      .limit(5);

    // ETAPA 5: Monta o system prompt completo via banco
    const promptData = await construirPrompt({
      agenteSlug: agente.slug,
      leadId: ctx.leadId,
      mercado: ctx.segmento,
      etapaFluxo: ctx.metadata?.etapa as string,
      mensagemAtual: ctx.mensagem,
    });

    if (!promptData) {
      return { sucesso: false, erro: "Não foi possível construir o prompt do agente" };
    }

    const systemPrompt = promptData.systemPrompt;
    const modelo = promptData.modelo;

    // ETAPA 6: Estima tokens antes de chamar
    const estimativa = Math.ceil((systemPrompt.length + ctx.mensagem.length) / 4);
    if (estimativa > 4000) {
      console.warn(`[ENGINE] Prompt grande: ~${estimativa} tokens`);
    }

    // ETAPA 7: Chama a IA
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { sucesso: false, erro: "ANTHROPIC_API_KEY não configurada" };

    const anthropic = new Anthropic({ apiKey });

    const mensagens: Array<{ role: "user" | "assistant"; content: string }> = [];

    // Adiciona histórico recente
    if (historico && historico.length > 0) {
      const histOrdenado = [...historico].reverse();
      for (const h of histOrdenado.slice(-4)) {
        mensagens.push({
          role: h.direcao === "entrada" ? "user" : "assistant",
          content: h.conteudo as string,
        });
      }
    }

    mensagens.push({ role: "user", content: ctx.mensagem });

    const resposta = await anthropic.messages.create({
      model: modelo,
      max_tokens: 1024,
      system: systemPrompt,
      messages: mensagens,
    });

    const textoResposta = resposta.content[0].type === "text" ? resposta.content[0].text : "";
    const tokensEntrada = resposta.usage.input_tokens;
    const tokensSaida = resposta.usage.output_tokens;
    const custo = calcularCusto(modelo, tokensEntrada, tokensSaida);
    const latencia = Date.now() - inicio;

    // ETAPA 8: Registra log (mesmo shape do webhook WhatsApp / CRM)
    const { data: logData } = await db
      .from("hub_prompt_logs")
      .insert({
        lead_id: ctx.leadId,
        agente_slug: agente.slug,
        system_prompt: systemPrompt,
        mensagem_usuario: ctx.mensagem,
        resposta_ia: textoResposta,
        modelo_usado: modelo,
        tokens_input: tokensEntrada,
        tokens_output: tokensSaida,
        custo_estimado_brl: custo.brl,
        foi_escalado: false,
      })
      .select("id")
      .maybeSingle();

    // ETAPA 9: Salva memórias extraídas (schema CRM: chave / valor)
    await extrairESalvarMemorias(ctx.leadId, ctx.mensagem, textoResposta);

    const statusSaida = ctx.statusFilaSaida ?? "pendente";
    const filaSaida: Record<string, unknown> = {
      lead_id: ctx.leadId,
      agente_id: agente.slug,
      canal: ctx.canal,
      direcao: "saida",
      conteudo: textoResposta,
      status: statusSaida,
      metadata: { logId: logData?.id, modelo, latencia, feito_por: "engine" },
    };
    if (ctx.tenantId) filaSaida.tenant_id = ctx.tenantId;

    // ETAPA 10: Enfileira resposta para envio
    await db.from("hub_fila_mensagens").insert(filaSaida);

    const hora = new Date().getHours();
    try {
      await db.from("hub_ml_padroes").insert({
        tipo: "horario_ideal",
        agente_id: agente.slug,
        padrao: JSON.stringify({ horario: `${hora}:00`, canal: ctx.canal, segmento: ctx.segmento }),
      });
    } catch (e) {
      console.warn("[ENGINE] hub_ml_padroes (opcional):", e);
    }

    return {
      sucesso: true,
      resposta: textoResposta,
      agenteSlug: agente.slug,
      agenteNome: agente.nome,
      modelo,
      tokens: { entrada: tokensEntrada, saida: tokensSaida },
      custo,
      latencia,
      logId: logData?.id,
    };

  } catch (erro) {
    const errMsg = erro instanceof Error ? erro.message : "Erro desconhecido";
    console.error("[ENGINE] Erro:", errMsg);

    // Tenta escalar para supervisor em caso de erro
    try {
      await escalarDemanda("sistema", errMsg, {
        tipo: "atendimento",
        canal: ctx.canal,
        mensagem: ctx.mensagem,
        leadId: ctx.leadId,
      }, ctx.leadId);
    } catch {}

    return { sucesso: false, erro: errMsg };
  }
}

// ── MONTA PROMPT COMPLETO ─────────────────────────────────────
function montarPromptCompleto(
  agente: { slug: string; nome: string; nivel: string; systemPrompt: string; fluxo?: { fase: string; proximoPasso: string; acaoEsperada: string }; regras?: Array<{ instrucao: string; prioridade: number }> },
  memorias: Array<{ tipo: string; conteudo: string; relevancia: number }>,
  regras: Array<{ instrucao: string; prioridade: number }>
): string {
  const secoes: string[] = [];

  secoes.push(`
═══════════════════════════════════════
IDENTIDADE E FUNÇÃO
═══════════════════════════════════════
${agente.systemPrompt}
Nível hierárquico: ${agente.nivel}
`.trim());

  if (agente.fluxo) {
    secoes.push(`
═══════════════════════════════════════
FLUXO ATUAL
═══════════════════════════════════════
Fase: ${agente.fluxo.fase}
Próximo passo: ${agente.fluxo.proximoPasso}
Ação esperada: ${agente.fluxo.acaoEsperada}
`.trim());
  }

  if (memorias.length > 0) {
    secoes.push(`
═══════════════════════════════════════
O QUE VOCÊ LEMBRA DESTE LEAD
═══════════════════════════════════════
${memorias.map(m => `• [${m.tipo}] ${m.conteudo}`).join("\n")}
`.trim());
  }

  if (regras.length > 0) {
    secoes.push(`
═══════════════════════════════════════
REGRAS ATIVAS
═══════════════════════════════════════
${regras.sort((a, b) => b.prioridade - a.prioridade).map(r => `• ${r.instrucao}`).join("\n")}
`.trim());
  }

  secoes.push(`
═══════════════════════════════════════
INSTRUÇÕES GERAIS
═══════════════════════════════════════
- Nunca tome decisões financeiras, de prazo ou proposta sozinho
- Quando não souber, diga que vai verificar
- Respostas curtas para WhatsApp (máximo 3 parágrafos)
- Nunca prometa o que não pode cumprir
- Se perceber que excede sua autonomia, informe que vai escalar
`.trim());

  return secoes.join("\n\n");
}

// ── EXTRAIR E SALVAR MEMÓRIAS (hub_memorias_lead: chave / valor) ─────────────────────────
async function extrairESalvarMemorias(
  leadId: string,
  mensagemUsuario: string,
  respostaIA: string
): Promise<void> {
  const db = supabase();
  const texto = `${mensagemUsuario} ${respostaIA}`.toLowerCase();

  const padroes = [
    { regex: /não (tenho|quero|posso|consigo|preciso)/gi, tipo: "objecao", relevancia: 0.8 },
    { regex: /preciso de|estou procurando|quero|gostaria|interesse/gi, tipo: "interesse", relevancia: 0.7 },
    { regex: /prefiro|gosto de|sempre uso|tenho costume/gi, tipo: "preferencia", relevancia: 0.6 },
    { regex: /comprei|fechei|acordo|contrato|fechamos/gi, tipo: "compra", relevancia: 0.9 },
    { regex: /orçamento|budget|investimento|valor|preço/gi, tipo: "financeiro", relevancia: 0.7 },
    { regex: /urgente|preciso logo|prazo|quando|data/gi, tipo: "comportamento", relevancia: 0.6 },
  ];

  for (const padrao of padroes) {
    const matches = texto.match(padrao.regex);
    if (!matches) continue;
    for (const match of matches.slice(0, 2)) {
      const valor = match.slice(0, 200);
      const chave = `${padrao.tipo}_auto`;

      const { data: existente } = await db
        .from("hub_memorias_lead")
        .select("id, confianca")
        .eq("lead_id", leadId)
        .eq("chave", chave)
        .ilike("valor", `%${valor.slice(0, Math.min(20, valor.length))}%`)
        .maybeSingle();

      if (existente) {
        await db
          .from("hub_memorias_lead")
          .update({
            confianca: Math.min(1, Number(existente.confianca) + 0.1),
          })
          .eq("id", existente.id);
      } else {
        await db.from("hub_memorias_lead").insert({
          lead_id: leadId,
          chave,
          valor,
          confianca: padrao.relevancia,
          criado_por: "ia_engine",
        });
      }
    }
  }
}

// ── CALCULAR CUSTO ────────────────────────────────────────────
export function calcularCusto(modelo: string, tokensEntrada: number, tokensSaida: number): { usd: number; brl: number } {
  const taxas: Record<string, { entrada: number; saida: number }> = {
    "claude-haiku-4-5":  { entrada: 0.00025, saida: 0.00125 },
    "claude-sonnet-4-5": { entrada: 0.003,   saida: 0.015   },
    "claude-opus-4-5":   { entrada: 0.015,   saida: 0.075   },
  };
  const taxa = taxas[modelo] || taxas["claude-haiku-4-5"];
  const usd = (tokensEntrada / 1000) * taxa.entrada + (tokensSaida / 1000) * taxa.saida;
  return { usd: parseFloat(usd.toFixed(6)), brl: parseFloat((usd * 5.75).toFixed(4)) };
}

// ── PROCESSAR DEMANDA INTERNA ─────────────────────────────────
// Para demandas que não são de atendimento (conteúdo, tráfego, sites, etc.)
export async function processarDemandaInterna(demanda: Demanda & {
  titulo: string;
  dados?: Record<string, unknown>;
}): Promise<ResultadoEngine> {
  const inicio = Date.now();
  const db = supabase();

  try {
    // Router encontra o agente certo para esta demanda
    const agente = await receberDemanda(demanda);
    if (!agente) return { sucesso: false, erro: "Nenhum agente disponível" };

    // Verifica autonomia
    const autonomia = await verificarAutonomia(agente.slug, demanda.tipo, 0);

    if (!autonomia.podeAgir) {
      const aprovacaoId = await criarAprovacao({
        tipo: demanda.tipo as "conteudo" | "campanha" | "site",
        agenteSlug: agente.slug,
        descricao: demanda.titulo,
        motivo: autonomia.motivo,
        impacto: "Aguardando aprovação para executar",
        dados: demanda.dados,
      });

      return { sucesso: true, precisaAprovacao: true, aprovacaoId: aprovacaoId || undefined };
    }

    const systemPrompt = montarPromptCompleto(agente, [], agente.regras || []);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { sucesso: false, erro: "ANTHROPIC_API_KEY não configurada" };

    const anthropic = new Anthropic({ apiKey });
    const resposta = await anthropic.messages.create({
      model: agente.modelo,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: `${demanda.titulo}\n\n${demanda.mensagem}` }],
    });

    const textoResposta = resposta.content[0].type === "text" ? resposta.content[0].text : "";
    const custo = calcularCusto(agente.modelo, resposta.usage.input_tokens, resposta.usage.output_tokens);

    await db.from("hub_prompt_logs").insert({
      agente_slug: agente.slug,
      modelo_usado: agente.modelo,
      tokens_input: resposta.usage.input_tokens,
      tokens_output: resposta.usage.output_tokens,
      custo_estimado_brl: custo.brl,
      mensagem_usuario: demanda.mensagem,
      resposta_ia: textoResposta,
      foi_escalado: false,
    });

    // Se o resultado precisa de aprovação humana, cria o card
    if (agente.hierarquia && agente.hierarquia.limiteAutonomiaBrl === 0) {
      await criarAprovacao({
        tipo: demanda.tipo as "conteudo" | "campanha" | "site",
        agenteSlug: agente.slug,
        descricao: `${agente.nome} concluiu: ${demanda.titulo}`,
        motivo: "Resultado pronto para revisão e aprovação",
        impacto: "Publicação ou execução após aprovação",
        recomendacao: textoResposta.slice(0, 200),
        confiancaIA: 85,
        dados: { resultado: textoResposta, demanda: demanda.dados },
      });
    }

    return {
      sucesso: true,
      resposta: textoResposta,
      agenteSlug: agente.slug,
      agenteNome: agente.nome,
      modelo: agente.modelo,
      tokens: { entrada: resposta.usage.input_tokens, saida: resposta.usage.output_tokens },
      custo,
      latencia: Date.now() - inicio,
    };

  } catch (erro) {
    const errMsg = erro instanceof Error ? erro.message : "Erro desconhecido";
    return { sucesso: false, erro: errMsg };
  }
}

// ── API ROUTE HANDLER ─────────────────────────────────────────
export { receberDemanda, escalarDemanda, verificarAutonomia, carregarAgentePorSlug } from "./router";
export { varrerSistema, monitorarTrafego } from "./monitor";
export { buscarAprovacoesPendentes, aprovar, rejeitar, criarAprovacao } from "./aprovacoes";
export { uploadArquivo, salvarConversa, buscarArquivosLead } from "./storage";
