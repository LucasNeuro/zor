// ============================================================
// ENGINE v2 — Motor de IA Universal
// Integra: Router + Monitor + Aprovações + Storage
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { receberDemanda, escalarDemanda, verificarAutonomia, carregarAgentePorSlug, type Demanda } from "./router";
import { criarAprovacao } from "./aprovacoes";
import { salvarConversa } from "./storage";
import { FLUXO_IMOBILIARIO, FLUXO_ARQUITETURA, MARI_CONFIG, identificarMercado, gerarSystemPromptCompleto } from "./agentes-config";
import { construirPrompt } from "./prompt-builder";
import { completarChatPreferindoMistral } from "./llm-completion";
import { completarChatComFerramentasMistral } from "./llm-completion-tools";
import { resolveInferenceModelId, isMistralFamilyModelId } from "./hub-model-defaults";
import {
  ferramentasMistralListaParaAgente,
  mergeUsoFerramentasComPadraoPreservandoCustom,
  mergeUsoFerramentasWhatsappCanal,
} from "@/lib/hub/agente-ferramentas-registry";
import { executarFerramentaHub } from "@/lib/hub/executar-ferramenta-ia";
import {
  fetchFerramentasCustomAtivas,
  rowParaMistralDef,
  type FerramentaCustomParaMistral,
} from "@/lib/hub/ferramentas-custom-db";
import {
  fetchFerramentasExternasAtivas,
  rowParaMistralDefExterna,
  type FerramentaExternaParaMistral,
} from "@/lib/hub/ferramentas-externas-db";
import { ferramentasIntegradorAtivasParaTenant } from "@/lib/hub/integradores-runtime";
import type { FerramentaIntegradorDefMistral } from "@/lib/hub/agente-ferramentas-registry";
import { defaultTenantId } from "@/lib/tenant-default";

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
  pessoaId?: string | null;
  /** Ex.: WhatsApp usa `pendente_envio` para alinhar ao envio UAZAPI após resposta da IA. */
  statusFilaSaida?: string;
}

export interface ResultadoEngine {
  sucesso: boolean;
  resposta?: string;
  toolCallsExecutadas?: Array<{ nome: string; ok: boolean; resultadoPreview?: string }>;
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
  motor?: "playbook_ia" | "playbook_flow" | "llm_prompt";
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
      ctx.valorEstimado || 0,
      ctx.canal
    );

    const bypassAprovacaoAtendimentoWhatsapp =
      demanda.tipo === "atendimento" &&
      ctx.canal === "whatsapp";

    if (!autonomia.podeAgir && !bypassAprovacaoAtendimentoWhatsapp) {
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

    if (!autonomia.podeAgir && bypassAprovacaoAtendimentoWhatsapp) {
      console.warn(
        `[ENGINE] autonomia bloqueada ignorada para atendimento WhatsApp (${agente.slug}): ${autonomia.motivo}`
      );
    }

    if (ctx.canal === "whatsapp" && ctx.leadId && ctx.telefone?.trim()) {
      const { sincronizarContatoWhatsappNoCrm } = await import("@/lib/crm/sincronizar-contato-whatsapp");
      await sincronizarContatoWhatsappNoCrm(db, {
        leadId: ctx.leadId,
        pessoaId: ctx.pessoaId ?? null,
        dados: {
          telefone: ctx.telefone,
          pushName: ctx.nome,
          messageId:
            typeof ctx.metadata?.messageId === "string" ? ctx.metadata.messageId : null,
          tipoMidia: typeof ctx.metadata?.tipoMidia === "string" ? ctx.metadata.tipoMidia : null,
          timestamp: typeof ctx.metadata?.timestamp === "string" ? ctx.metadata.timestamp : null,
          mercado: ctx.segmento,
          instanceKey: typeof ctx.metadata?.instance === "string" ? ctx.metadata.instance : null,
        },
      });
    }

    // ETAPA 4: Histórico — metadata CRM (fiável) + hub_fila_mensagens
    const { buscarHistoricoConversa } = await import("@/lib/ia/conversation-context");
    let turnosCrm: import("@/lib/crm/conversa-turnos-crm").TurnoConversaCrm[] = [];
    if (ctx.canal === "whatsapp" && ctx.leadId) {
      const crmTurnos = await import("@/lib/crm/conversa-turnos-crm");
      turnosCrm = await crmTurnos.registarEntradaUsuarioCrm(db, ctx.leadId, ctx.mensagem);
    }
    const historicoCtx = await buscarHistoricoConversa(db, { leadId: ctx.leadId });
    if (historicoCtx.sessaoReiniciada) {
      turnosCrm = turnosCrm.filter((t) => {
        const msg = ctx.mensagem.trim();
        return t.role === "user" && t.content.trim() === msg;
      });
    }
    const turnosAnteriores = historicoCtx.sessaoReiniciada
      ? 0
      : ctx.canal === "whatsapp"
        ? Math.max(
            (await import("@/lib/crm/conversa-turnos-crm")).contarTurnosAnteriores(
              turnosCrm,
              ctx.mensagem
            ),
            historicoCtx.linhas.length
          )
        : historicoCtx.linhas.length;

    let etapaFluxo = typeof ctx.metadata?.etapa === "string" ? ctx.metadata.etapa : undefined;
    if (!etapaFluxo) {
      const { data: fluxoRow } = await db
        .from("hub_fluxos")
        .select("fase, proximo_passo, acao_esperada")
        .eq("agente_slug", agente.slug)
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (fluxoRow) {
        etapaFluxo = `Fase: ${fluxoRow.fase}\nPróximo passo: ${fluxoRow.proximo_passo}\nAção esperada: ${fluxoRow.acao_esperada}`;
      }
    }

    // ETAPA 5: Monta o system prompt completo via banco
    const turnosParaPrompt =
      ctx.canal === "whatsapp" && turnosCrm.length > 0
        ? turnosCrm.map((t) => ({ role: t.role, content: t.content }))
        : historicoCtx.linhas.map((l) => ({ role: l.role, content: l.content }));

    const blocoContextoFluxoPlaybook =
      typeof ctx.metadata?.blocoContextoFluxoPlaybook === "string"
        ? ctx.metadata.blocoContextoFluxoPlaybook.trim()
        : undefined;
    const motorPlaybook =
      ctx.metadata?.motorPlaybook === "playbook_ia" ||
      ctx.metadata?.motorPlaybook === "playbook_flow" ||
      ctx.metadata?.motorPlaybook === "llm_prompt"
        ? ctx.metadata.motorPlaybook
        : undefined;

    const promptData = await construirPrompt({
      agenteSlug: agente.slug,
      leadId: ctx.leadId,
      mercado: ctx.segmento,
      etapaFluxo: historicoCtx.sessaoReiniciada ? undefined : etapaFluxo,
      mensagemAtual: ctx.mensagem,
      canal: ctx.canal,
      turnosAnteriores,
      turnosConversa: turnosParaPrompt,
      sessaoReiniciada: historicoCtx.sessaoReiniciada,
      blocoContextoFluxoPlaybook,
    });

    if (!promptData) {
      return { sucesso: false, erro: "Não foi possível construir o prompt do agente" };
    }

    let systemPrompt = promptData.systemPrompt;
    const linhasContexto =
      ctx.canal === "whatsapp" && turnosCrm.length > 0
        ? turnosCrm.map((t) => ({ role: t.role, content: t.content }))
        : historicoCtx.linhas;
    if (linhasContexto.length > 0) {
      const { formatarBlocoContextoConversa } = await import("@/lib/ia/conversation-context");
      const bloco = formatarBlocoContextoConversa(linhasContexto);
      if (bloco) systemPrompt = `${systemPrompt}\n\n${bloco}`;
    }
    if (ctx.canal === "whatsapp") {
      const { blocoDadosCanalWhatsappCrm } = await import("@/lib/crm/sincronizar-contato-whatsapp");
      const { blocoIsolamentoConversaWhatsapp } = await import("@/lib/crm/isolamento-conversa-lead");
      systemPrompt = `${systemPrompt}\n\n${blocoDadosCanalWhatsappCrm({
        telefone: ctx.telefone,
        pushName: ctx.nome,
        leadId: ctx.leadId,
      })}\n\n${blocoIsolamentoConversaWhatsapp(ctx.telefone)}`;
    }
    const modelo = promptData.modelo;

    // ETAPA 6: Estima tokens antes de chamar
    const estimativa = Math.ceil((systemPrompt.length + ctx.mensagem.length) / 4);
    if (estimativa > 4000) {
      console.warn(`[ENGINE] Prompt grande: ~${estimativa} tokens`);
    }

    // ETAPA 7: Chama a IA
    const mensagens: Array<{ role: "user" | "assistant"; content: string }> = [];

    if (!historicoCtx.sessaoReiniciada && historicoCtx.resumoAnterior?.trim()) {
      mensagens.push({
        role: "user",
        content: `[Resumo da conversa anterior — use como contexto, não cumprimente de novo por isto]\n${historicoCtx.resumoAnterior.trim()}`,
      });
    }

    if (ctx.canal === "whatsapp" && turnosCrm.length > 0) {
      const { turnosParaMensagensLlm } = await import("@/lib/crm/conversa-turnos-crm");
      mensagens.push(...turnosParaMensagensLlm(turnosCrm, ctx.mensagem));
    } else {
      for (const h of historicoCtx.linhas) {
        mensagens.push({ role: h.role, content: h.content });
      }
      const msgAtual = ctx.mensagem.trim();
      const ultimaLinha = historicoCtx.linhas[historicoCtx.linhas.length - 1];
      const jaIncluiuMensagemAtual =
        ultimaLinha?.role === "user" && ultimaLinha.content.trim() === msgAtual;
      if (!jaIncluiuMensagemAtual) {
        mensagens.push({ role: "user", content: ctx.mensagem });
      }
    }

    const { data: ferrIaRow } = await db
      .from("hub_agente_identidade")
      .select("motor_ferramentas_habilitado, uso_ferramentas_ia, modo_operacao")
      .eq("agente_slug", agente.slug)
      .maybeSingle();

    const motorFerramentas = ferrIaRow?.motor_ferramentas_habilitado === true;
    const tenantForTools = (ctx.tenantId && ctx.tenantId.trim()) || defaultTenantId();
    let customDefs: FerramentaCustomParaMistral[] = [];
    try {
      const rows = await fetchFerramentasCustomAtivas(db, tenantForTools);
      customDefs = rows.map(rowParaMistralDef);
    } catch {
      customDefs = [];
    }
    let extDefs: FerramentaExternaParaMistral[] = [];
    try {
      const extRows = await fetchFerramentasExternasAtivas(db, tenantForTools);
      extDefs = extRows.map(rowParaMistralDefExterna);
    } catch {
      extDefs = [];
    }
    let intDefs: FerramentaIntegradorDefMistral[] = [];
    try {
      const rows = await ferramentasIntegradorAtivasParaTenant(db, tenantForTools);
      intDefs = rows.map((r) => ({
        ferramenta_key: r.ferramenta_key,
        descricao_modelo: r.descricao_modelo,
        parametros_schema: r.parametros_schema,
      }));
    } catch {
      intDefs = [];
    }
    const modoOp =
      ferrIaRow?.modo_operacao ??
      (ctx.canal === "whatsapp" ? "canal_whatsapp" : ctx.canal === "email" ? "canal_email" : null);
    const usoMap = mergeUsoFerramentasWhatsappCanal(
      mergeUsoFerramentasComPadraoPreservandoCustom(ferrIaRow?.uso_ferramentas_ia ?? {}),
      modoOp
    );
    const mistralTools = ferramentasMistralListaParaAgente(usoMap, customDefs, extDefs, intDefs);
    const modeloResolved = resolveInferenceModelId(modelo);
    const temMistralKey = Boolean(process.env.MISTRAL_API_KEY?.trim());
    const podeToolsMistral =
      temMistralKey &&
      motorFerramentas &&
      mistralTools.length > 0 &&
      Boolean(ctx.leadId) &&
      isMistralFamilyModelId(modeloResolved);

    let out = podeToolsMistral
      ? await completarChatComFerramentasMistral({
          systemPrompt,
          mensagens,
          modeloFromDb: modelo,
          tools: mistralTools,
          maxTokens: 1024,
          playbookPublicado: promptData.playbookPublicado === true,
          executarTool: (nome, argumentosSerializados) =>
            executarFerramentaHub(nome, argumentosSerializados, {
              leadId: ctx.leadId!,
              agenteSlug: agente.slug,
              tenantId: ctx.tenantId,
              telefoneSessao: ctx.telefone,
              modoOperacao:
                (ferrIaRow as { modo_operacao?: string | null } | null | undefined)?.modo_operacao ?? null,
            }),
        })
      : await completarChatPreferindoMistral({
          systemPrompt,
          mensagens,
          modeloFromDb: modelo,
          maxTokens: 1024,
        });
    // Se tools Mistral falharem (ex.: 503 temporário), tenta sem tools antes de desistir.
    if (!out.ok && podeToolsMistral) {
      const fallbackSemTools = await completarChatPreferindoMistral({
        systemPrompt,
        mensagens,
        modeloFromDb: modelo,
        maxTokens: 1024,
      });
      if (fallbackSemTools.ok) {
        out = fallbackSemTools;
      }
    }
    if (!out.ok) {
      return { sucesso: false, erro: out.erro };
    }

    const textoResposta = out.texto;
    const tokensEntrada = out.tokensEntrada;
    const tokensSaida = out.tokensSaida;
    const modeloLog = out.modeloLog;
    const maybeToolCalls = (out as { toolCallsExecutadas?: unknown }).toolCallsExecutadas;
    const toolCallsExecutadas: Array<{ nome: string; ok: boolean; resultadoPreview?: string }> =
      Array.isArray(maybeToolCalls)
        ? (maybeToolCalls as Array<{ nome: string; ok: boolean; resultadoPreview?: string }>)
        : [];
    const custo = calcularCusto(modeloLog, tokensEntrada, tokensSaida);
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
        modelo_usado: modeloLog,
        tokens_input: tokensEntrada,
        tokens_output: tokensSaida,
        custo_estimado_brl: custo.brl,
        foi_escalado: false,
        metadata: {
          tool_calls_executadas: toolCallsExecutadas.slice(0, 12),
          motor: motorPlaybook ?? (blocoContextoFluxoPlaybook ? "playbook_ia" : "llm_prompt"),
        },
      })
      .select("id")
      .maybeSingle();

    // ETAPA 9: Salva memórias extraídas (lead + agente) via LLM
    if (ctx.canal === "whatsapp" && ctx.leadId) {
      const { registarRespostaAssistenteCrm } = await import("@/lib/crm/conversa-turnos-crm");
      await registarRespostaAssistenteCrm(db, ctx.leadId, textoResposta);
    }

    const { persistirDadosLeadWhatsapp } = await import("@/lib/crm/persistir-lead-whatsapp");
    await persistirDadosLeadWhatsapp(db, {
      leadId: ctx.leadId,
      mensagemUsuario: ctx.mensagem,
      respostaIA: textoResposta,
      agenteSlug: agente.slug,
      pessoaId: ctx.pessoaId ?? null,
      telefone: ctx.telefone,
      pushName: ctx.nome,
    });

    if (ctx.canal === "whatsapp") {
      const { reforcarCrmAposTurnoWhatsapp } = await import("@/lib/crm/sincronizar-contato-whatsapp");
      await reforcarCrmAposTurnoWhatsapp(db, {
        leadId: ctx.leadId,
        mensagemUsuario: ctx.mensagem,
        pushName: ctx.nome,
        telefone: ctx.telefone,
        toolCallsExecutadas,
      });
    }
    try {
      const { extrairESalvarMemoriasAgente } = await import("@/lib/ia/memoria-agente");
      await extrairESalvarMemoriasAgente(db, {
        agenteSlug: agente.slug,
        tenantId: ctx.tenantId,
        mensagemUsuario: ctx.mensagem,
        respostaIA: textoResposta,
        origem: ctx.canal === "whatsapp" ? "whatsapp" : "ia_engine",
      });
    } catch {
      /* hub_memorias_agente opcional até migração aplicada */
    }

    const statusSaida = ctx.statusFilaSaida ?? "enviado";
    const filaSaida: Record<string, unknown> = {
      lead_id: ctx.leadId,
      agente_id: agente.slug,
      canal: ctx.canal,
      direcao: "saida",
      conteudo: textoResposta,
      status: statusSaida,
      metadata: {
        logId: logData?.id,
        modelo: modeloLog,
        latencia,
        feito_por: "engine",
        motor: motorPlaybook ?? (blocoContextoFluxoPlaybook ? "playbook_ia" : "llm_prompt"),
      },
    };
    if (ctx.tenantId) filaSaida.tenant_id = ctx.tenantId;

    // ETAPA 10: Persiste turno na fila (entrada + saída) para histórico fluido no WhatsApp
    const filaEntrada: Record<string, unknown> = {
      lead_id: ctx.leadId,
      agente_id: agente.slug,
      canal: ctx.canal,
      direcao: "entrada",
      conteudo: ctx.mensagem,
      status: "pendente",
      metadata: { feito_por: "engine", messageId: ctx.metadata?.messageId ?? null },
    };
    if (ctx.tenantId) filaEntrada.tenant_id = ctx.tenantId;
    try {
      await db.from("hub_fila_mensagens").insert(filaEntrada);
    } catch (e) {
      console.warn("[ENGINE] hub_fila_mensagens entrada:", e);
    }
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
      toolCallsExecutadas,
      agenteSlug: agente.slug,
      agenteNome: agente.nome,
      modelo: modeloLog,
      tokens: { entrada: tokensEntrada, saida: tokensSaida },
      custo,
      latencia,
      logId: logData?.id,
      motor: motorPlaybook ?? (blocoContextoFluxoPlaybook ? "playbook_ia" : "llm_prompt"),
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

// ── CALCULAR CUSTO ────────────────────────────────────────────
export function calcularCusto(modelo: string, tokensEntrada: number, tokensSaida: number): { usd: number; brl: number } {
  const m = modelo.toLowerCase();
  if (m.includes("mistral") || m.includes("mixtral") || m.includes("ministral")) {
    const entrada = 0.00015;
    const saida = 0.00045;
    const usd =
      (tokensEntrada / 1000) * entrada + (tokensSaida / 1000) * saida;
    return { usd: parseFloat(usd.toFixed(6)), brl: parseFloat((usd * 5.75).toFixed(4)) };
  }
  const taxas: Record<string, { entrada: number; saida: number }> = {
    "claude-haiku-4-5":  { entrada: 0.00025, saida: 0.00125 },
    "claude-sonnet-4-5": { entrada: 0.003,   saida: 0.015   },
    "claude-opus-4-5":   { entrada: 0.015,   saida: 0.075   },
    "claude-haiku-4-5-20251001": { entrada: 0.00025, saida: 0.00125 },
    "claude-sonnet-4-6": { entrada: 0.003, saida: 0.015 },
    "claude-opus-4-7": { entrada: 0.015, saida: 0.075 },
  };
  const heur =
    m.includes("opus")
      ? taxas["claude-opus-4-5"]
      : m.includes("sonnet")
        ? taxas["claude-sonnet-4-5"]
        : taxas["claude-haiku-4-5"];
  const taxa = taxas[modelo] || heur;
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
    const autonomia = await verificarAutonomia(agente.slug, demanda.tipo, 0, demanda.canal);

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

    const saida = await completarChatPreferindoMistral({
      systemPrompt,
      mensagens: [{ role: "user", content: `${demanda.titulo}\n\n${demanda.mensagem}` }],
      modeloFromDb: agente.modelo,
      maxTokens: 2048,
    });
    if (!saida.ok) return { sucesso: false, erro: saida.erro };

    const textoResposta = saida.texto;
    const custo = calcularCusto(saida.modeloLog, saida.tokensEntrada, saida.tokensSaida);

    await db.from("hub_prompt_logs").insert({
      agente_slug: agente.slug,
      modelo_usado: saida.modeloLog,
      tokens_input: saida.tokensEntrada,
      tokens_output: saida.tokensSaida,
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
      modelo: saida.modeloLog,
      tokens: { entrada: saida.tokensEntrada, saida: saida.tokensSaida },
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
