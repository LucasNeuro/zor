// ============================================================
// ROUTER — Roteamento Inteligente Universal
// Qualquer demanda entra aqui e encontra o agente certo
// ============================================================
import { createClient } from "@supabase/supabase-js";
import {
  avaliarRegrasMatriz,
  filtrarRegrasPorCanal,
  type CanalAutonomia,
  type HubAutonomiaMatrizRow,
} from "./autonomia-matriz";
import { HUB_MODELO_SENTINEL } from "./hub-model-defaults";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export interface Demanda {
  tipo: "atendimento" | "conteudo" | "trafego" | "site" | "financeiro" | "estrategia" | "qualidade";
  canal: "whatsapp" | "instagram" | "email" | "interno" | "site";
  mensagem: string;
  leadId?: string;
  clienteId?: string;
  segmento?: string;
  valorEstimado?: number;
  contexto?: Record<string, unknown>;
  arquivos?: string[];
}

export interface AgenteSelecionado {
  slug: string;
  nome: string;
  nivel: string;
  modelo: string;
  systemPrompt: string;
  fluxo?: FluxoAtivo;
  regras?: RegraIA[];
  hierarquia?: HierarquiaAgente;
}

export interface FluxoAtivo {
  id: string;
  fase: string;
  proximoPasso: string;
  acaoEsperada: string;
}

export interface RegraIA {
  instrucao: string;
  prioridade: number;
}

export interface HierarquiaAgente {
  nivel: string;
  supervisorSlug: string;
  subordinados: string[];
  limiteAutonomiaBrl: number;
  criteriosEscalonamento: string[];
}

// ── RECEPTOR UNIVERSAL ────────────────────────────────────────
// Entende a demanda e encontra o agente certo no banco
export async function receberDemanda(demanda: Demanda): Promise<AgenteSelecionado | null> {
  const db = supabase();

  // 1. Busca todos os agentes ativos
  const { data: agentes } = await db
    .from("hub_agente_identidade")
    .select("*")
    .eq("ativo", true);

  if (!agentes || agentes.length === 0) return null;

  // 2. Busca configurações dos agentes
  const slugs = agentes.map((a: Record<string, unknown>) => a.agente_slug);
  const { data: configs } = await db
    .from("hub_agente_configuracao")
    .select("*")
    .in("agente_slug", slugs)
    .eq("ativo", true);

  // 3. Pontua cada agente para a demanda
  const scores = await Promise.all(
    agentes.map(async (agente: Record<string, unknown>) => {
      const config = configs?.find((c: Record<string, unknown>) => c.agente_slug === agente.agente_slug);
      const score = calcularScore(agente, config, demanda);
      return { agente, config, score };
    })
  );

  // 4. Seleciona o mais adequado
  const melhor = scores
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  if (!melhor) return null;

  // 5. Busca fluxo ativo para este agente e tipo de demanda
  const { data: fluxos } = await db
    .from("hub_fluxos")
    .select("*")
    .eq("agente_slug", melhor.agente.agente_slug)
    .eq("ativo", true)
    .order("ordem", { ascending: true })
    .limit(1);

  const fluxo = fluxos?.[0];

  // 6. Busca regras de IA do agente
  const { data: regras } = await db
    .from("hub_regras_ia")
    .select("*")
    .eq("agente_slug", melhor.agente.agente_slug)
    .eq("ativo", true)
    .order("prioridade", { ascending: false });

  // 7. Busca hierarquia do agente
  const { data: hierarquia } = await db
    .from("hub_hierarquia")
    .select("*")
    .eq("agente_slug", melhor.agente.agente_slug)
    .single();

  // 8. Seleciona modelo baseado no valor e criticidade
  const modelo = selecionarModelo(melhor.agente, demanda);

  return montarAgenteSelecionado(melhor.agente as Record<string, unknown>, demanda, {
    fluxo,
    regras,
    hierarquia,
  });
}

/** Carrega um agente ativo por slug (fluxo, regras, hierarquia) — usado p.ex. pelo WhatsApp com mercado já resolvido. */
export async function carregarAgentePorSlug(slug: string, demanda: Demanda): Promise<AgenteSelecionado | null> {
  const db = supabase();
  const { data: agenteRow } = await db
    .from("hub_agente_identidade")
    .select("*")
    .eq("agente_slug", slug)
    .eq("ativo", true)
    .is("arquivado_em", null)
    .maybeSingle();

  if (!agenteRow) return null;

  const { data: fluxos } = await db
    .from("hub_fluxos")
    .select("*")
    .eq("agente_slug", slug)
    .eq("ativo", true)
    .order("ordem", { ascending: true })
    .limit(1);

  const { data: regras } = await db
    .from("hub_regras_ia")
    .select("*")
    .eq("agente_slug", slug)
    .eq("ativo", true)
    .order("prioridade", { ascending: false });

  const { data: hierarquia } = await db
    .from("hub_hierarquia")
    .select("*")
    .eq("agente_slug", slug)
    .maybeSingle();

  const fluxo = fluxos?.[0];
  return montarAgenteSelecionado(agenteRow as Record<string, unknown>, demanda, {
    fluxo,
    regras,
    hierarquia,
  });
}

function montarAgenteSelecionado(
  agente: Record<string, unknown>,
  demanda: Demanda,
  parts: {
    fluxo?: Record<string, unknown>;
    regras?: Record<string, unknown>[] | null;
    hierarquia?: Record<string, unknown> | null;
  }
): AgenteSelecionado {
  const { fluxo, regras, hierarquia } = parts;
  const modelo = selecionarModelo(agente, demanda);

  return {
    slug: agente.agente_slug as string,
    nome: agente.nome as string,
    nivel: (hierarquia?.nivel as string) || "executor",
    modelo,
    systemPrompt: (agente.system_prompt_base as string) || "",
    fluxo: fluxo
      ? {
          id: fluxo.id as string,
          fase: fluxo.fase as string,
          proximoPasso: fluxo.proximo_passo as string,
          acaoEsperada: fluxo.acao_esperada as string,
        }
      : undefined,
    regras: regras?.map((r: Record<string, unknown>) => ({
      instrucao: r.instrucao as string,
      prioridade: r.prioridade as number,
    })),
    hierarquia: hierarquia
      ? {
          nivel: hierarquia.nivel as string,
          supervisorSlug: hierarquia.supervisor_slug as string,
          subordinados: (hierarquia.subordinados as string[]) || [],
          limiteAutonomiaBrl: (hierarquia.limite_autonomia_brl as number) || 0,
          criteriosEscalonamento: (hierarquia.criterios_escalonamento as string[]) || [],
        }
      : undefined,
  };
}

// ── PONTUAÇÃO DO AGENTE ───────────────────────────────────────
function calcularScore(
  agente: Record<string, unknown>,
  config: Record<string, unknown> | undefined,
  demanda: Demanda
): number {
  let score = 0;
  const area = (agente.area as string || "").toLowerCase();
  const cargo = (agente.cargo as string || "").toLowerCase();
  const pode = (agente.pode_fazer as string[] || []).map(p => p.toLowerCase());
  const prefixo = (agente.prefixo_mercado as string || "").toLowerCase();

  // Match por tipo de demanda
  if (demanda.tipo === "atendimento" && (area.includes("atendimento") || cargo.includes("sdr") || cargo.includes("atendente"))) score += 50;
  if (demanda.tipo === "conteudo" && (area.includes("marketing") || area.includes("conteudo"))) score += 50;
  if (demanda.tipo === "trafego" && (area.includes("trafego") || area.includes("marketing"))) score += 50;
  if (demanda.tipo === "site" && (area.includes("operac") || cargo.includes("dev"))) score += 50;
  if (demanda.tipo === "estrategia" && (cargo.includes("diretor") || cargo.includes("ceo") || cargo.includes("estrateg"))) score += 50;
  if (demanda.tipo === "qualidade" && cargo.includes("revisor")) score += 50;

  // Match por segmento/mercado
  if (demanda.segmento && prefixo && demanda.segmento.toLowerCase().includes(prefixo)) score += 30;

  // Match por canal
  const canaisConfig = config?.canais_atendidos as string[] || [];
  if (canaisConfig.includes(demanda.canal)) score += 20;

  // Match por skills (pode_fazer)
  if (pode.some(p => p.includes(demanda.tipo))) score += 15;

  // Verificar horário de trabalho
  const agora = new Date();
  const hora = agora.toTimeString().slice(0, 5);
  const inicio = config?.horario_inicio as string || "08:00";
  const fim = config?.horario_fim as string || "18:00";
  const diaSemana = agora.getDay();
  const dias = config?.dias_semana as number[] || [1, 2, 3, 4, 5];

  if (!dias.includes(diaSemana)) score -= 100;
  if (hora < inicio || hora > fim) score -= 50;

  // Penalidade por nível inadequado para a tarefa
  const nivel = agente.nivel as number || 5;
  if (demanda.valorEstimado && demanda.valorEstimado > 100000 && nivel > 2) score -= 30;
  if (demanda.tipo === "estrategia" && nivel > 2) score -= 40;

  return score;
}

// ── SELEÇÃO DE MODELO ─────────────────────────────────────────
function selecionarModelo(agente: Record<string, unknown>, demanda: Demanda): string {
  const valor = demanda.valorEstimado || 0;

  if (valor > 100000) {
    const m = (agente.modelo_alto_valor as string)?.trim();
    return m || HUB_MODELO_SENTINEL;
  }
  if (valor > 20000) {
    const m = (agente.modelo_critico as string)?.trim();
    return m || HUB_MODELO_SENTINEL;
  }
  const m = (agente.modelo_padrao as string)?.trim();
  return m || HUB_MODELO_SENTINEL;
}

// ── ESCALADOR UNIVERSAL ───────────────────────────────────────
// Quando um agente não consegue resolver, escala para o supervisor
export async function escalarDemanda(
  slugAtual: string,
  motivo: string,
  demanda: Demanda,
  leadId?: string
): Promise<AgenteSelecionado | null> {
  const db = supabase();

  const { data: hierarquia } = await db
    .from("hub_hierarquia")
    .select("*")
    .eq("agente_slug", slugAtual)
    .single();

  if (!hierarquia?.supervisor_slug) return null;

  // Registra a escalada
  await db.from("hub_decision_logs").insert({
    agente_slug: slugAtual,
    tipo: "escalada",
    descricao: motivo,
    lead_id: leadId,
    valor_envolvido: demanda.valorEstimado || 0,
    resultado: `Escalado para ${hierarquia.supervisor_slug}`,
  });

  // Busca o supervisor
  const { data: supervisor } = await db
    .from("hub_agente_identidade")
    .select("*")
    .eq("agente_slug", hierarquia.supervisor_slug)
    .single();

  if (!supervisor) return null;

  return receberDemanda({ ...demanda, contexto: { ...demanda.contexto, escaladoDe: slugAtual, motivo } });
}

function normalizarCriteriosEscalonamento(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    try {
      const j = JSON.parse(t) as unknown;
      if (Array.isArray(j)) return j.map((x) => String(x).trim()).filter(Boolean);
    } catch {
      /* não é JSON */
    }
    return t.split(/[\n,;|]+/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// ── VERIFICADOR DE AUTONOMIA ──────────────────────────────────
// Ordem: hub_autonomia_matriz (por canal + gatilhos) → hub_hierarquia (limite BRL + critérios texto/JSON).
export async function verificarAutonomia(
  slugAgente: string,
  acao: string,
  valorEnvolvido: number,
  canal?: CanalAutonomia
): Promise<{ podeAgir: boolean; motivo: string; precisaAprovacao: boolean }> {
  const db = supabase();

  const { data: linhasMatriz } = await db
    .from("hub_autonomia_matriz")
    .select("*")
    .eq("agente_slug", slugAgente)
    .eq("ativo", true)
    .order("prioridade", { ascending: false });

  const aplicaveis = filtrarRegrasPorCanal(
    (linhasMatriz || []) as HubAutonomiaMatrizRow[],
    canal
  );
  const bloqueioMatriz = avaliarRegrasMatriz(aplicaveis, acao, valorEnvolvido);
  if (bloqueioMatriz?.bloqueado) {
    return { podeAgir: false, motivo: bloqueioMatriz.motivo, precisaAprovacao: true };
  }

  const { data: hierarquia } = await db
    .from("hub_hierarquia")
    .select("*")
    .eq("agente_slug", slugAgente)
    .maybeSingle();

  if (!hierarquia) return { podeAgir: false, motivo: "Agente sem hierarquia configurada", precisaAprovacao: true };

  const limite = Number(hierarquia.limite_autonomia_brl) || 0;
  const criterios = normalizarCriteriosEscalonamento(hierarquia.criterios_escalonamento);

  // Verifica limite financeiro
  if (valorEnvolvido > limite) {
    return {
      podeAgir: false,
      motivo: `Valor R$${valorEnvolvido.toLocaleString("pt-BR")} acima do limite de autonomia R$${limite.toLocaleString("pt-BR")}`,
      precisaAprovacao: true,
    };
  }

  // Verifica critérios de escalamento
  const acaoLower = acao.toLowerCase();
  for (const criterio of criterios) {
    if (acaoLower.includes(criterio.toLowerCase())) {
      return {
        podeAgir: false,
        motivo: `Ação "${acao}" requer aprovação: ${criterio}`,
        precisaAprovacao: true,
      };
    }
  }

  return { podeAgir: true, motivo: "Dentro dos limites de autonomia", precisaAprovacao: false };
}
