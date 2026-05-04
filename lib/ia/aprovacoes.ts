// ============================================================
// APROVAÇÕES — Sistema Universal de Aprovação Humana
// Tudo que precisa de humano chega aqui como card completo
// ============================================================
import { createClient } from "@supabase/supabase-js";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export type TipoAprovacao =
  | "proposta"
  | "campanha"
  | "conteudo"
  | "site"
  | "ajuste_agente"
  | "trafego"
  | "contrato"
  | "financeiro"
  | "atendimento_critico";

export interface CardAprovacao {
  id: string;
  tipo: TipoAprovacao;
  titulo: string;
  descricao: string;
  agenteSlug: string;
  agenteNome: string;
  leadId?: string;
  clienteNome?: string;
  valorEnvolvido?: number;
  impacto: string;
  recomendacao: string;
  confiancaIA: number;
  prazo?: string;
  dados: Record<string, unknown>;
  status: "pendente" | "aprovado" | "rejeitado";
  criadoEm: string;
  acoes: AcaoCard[];
}

export interface AcaoCard {
  label: string;
  tipo: "aprovar" | "rejeitar" | "ver_mais" | "editar";
  estilo: "primario" | "secundario" | "perigo" | "neutro";
}

// ── BUSCAR APROVAÇÕES PENDENTES ───────────────────────────────
export async function buscarAprovacoesPendentes(): Promise<CardAprovacao[]> {
  const db = supabase();

  const { data } = await db
    .from("hub_aprovacoes")
    .select("*")
    .eq("status", "pendente")
    .order("criado_em", { ascending: false });

  if (!data) return [];

  return data.map((item: Record<string, unknown>) => montarCard(item));
}

// ── MONTAR CARD DE APROVAÇÃO ──────────────────────────────────
function montarCard(item: Record<string, unknown>): CardAprovacao {
  const tipo = item.tipo as TipoAprovacao;
  const dados = item.dados as Record<string, unknown> || {};

  const ACOES_POR_TIPO: Record<TipoAprovacao, AcaoCard[]> = {
    proposta: [
      { label: "Aprovar proposta", tipo: "aprovar", estilo: "primario" },
      { label: "Ver proposta completa", tipo: "ver_mais", estilo: "neutro" },
      { label: "Rejeitar", tipo: "rejeitar", estilo: "perigo" },
    ],
    campanha: [
      { label: "Aprovar ação", tipo: "aprovar", estilo: "primario" },
      { label: "Ver análise", tipo: "ver_mais", estilo: "neutro" },
      { label: "Ignorar", tipo: "rejeitar", estilo: "secundario" },
    ],
    conteudo: [
      { label: "Aprovar", tipo: "aprovar", estilo: "primario" },
      { label: "Pedir ajuste", tipo: "rejeitar", estilo: "secundario" },
      { label: "Ver conteúdo", tipo: "ver_mais", estilo: "neutro" },
    ],
    site: [
      { label: "Aprovar publicação", tipo: "aprovar", estilo: "primario" },
      { label: "Pedir revisão", tipo: "rejeitar", estilo: "secundario" },
      { label: "Ver página", tipo: "ver_mais", estilo: "neutro" },
    ],
    ajuste_agente: [
      { label: "Aprovar ajuste", tipo: "aprovar", estilo: "primario" },
      { label: "Ver análise completa", tipo: "ver_mais", estilo: "neutro" },
      { label: "Rejeitar", tipo: "rejeitar", estilo: "perigo" },
    ],
    trafego: [
      { label: "Aprovar ação", tipo: "aprovar", estilo: "primario" },
      { label: "Ver dados", tipo: "ver_mais", estilo: "neutro" },
      { label: "Ignorar por agora", tipo: "rejeitar", estilo: "secundario" },
    ],
    contrato: [
      { label: "Assinar contrato", tipo: "aprovar", estilo: "primario" },
      { label: "Revisar termos", tipo: "editar", estilo: "secundario" },
      { label: "Recusar", tipo: "rejeitar", estilo: "perigo" },
    ],
    financeiro: [
      { label: "Autorizar", tipo: "aprovar", estilo: "primario" },
      { label: "Ver detalhes", tipo: "ver_mais", estilo: "neutro" },
      { label: "Recusar", tipo: "rejeitar", estilo: "perigo" },
    ],
    atendimento_critico: [
      { label: "Assumir atendimento", tipo: "aprovar", estilo: "primario" },
      { label: "Atribuir para equipe", tipo: "editar", estilo: "secundario" },
      { label: "Ver conversa", tipo: "ver_mais", estilo: "neutro" },
    ],
  };

  return {
    id: item.id as string,
    tipo,
    titulo: item.descricao as string || "Aprovação pendente",
    descricao: item.motivo as string || "",
    agenteSlug: item.agente_slug as string || "",
    agenteNome: item.agente_nome as string || item.agente_slug as string || "",
    leadId: item.lead_id as string,
    clienteNome: dados.cliente_nome as string,
    valorEnvolvido: item.valor_envolvido as number || dados.valor as number,
    impacto: item.impacto as string || "",
    recomendacao: item.recomendacao as string || "IA recomenda aprovação",
    confiancaIA: item.confianca_ia as number || 85,
    prazo: item.prazo as string,
    dados,
    status: item.status as "pendente" | "aprovado" | "rejeitado",
    criadoEm: item.criado_em as string,
    acoes: ACOES_POR_TIPO[tipo] || [
      { label: "Aprovar", tipo: "aprovar", estilo: "primario" },
      { label: "Rejeitar", tipo: "rejeitar", estilo: "perigo" },
    ],
  };
}

// ── APROVAR ───────────────────────────────────────────────────
export async function aprovar(
  aprovacaoId: string,
  observacao?: string
): Promise<{ sucesso: boolean; erro?: string }> {
  const db = supabase();

  const { data: aprovacao } = await db
    .from("hub_aprovacoes")
    .select("*")
    .eq("id", aprovacaoId)
    .single();

  if (!aprovacao) return { sucesso: false, erro: "Aprovação não encontrada" };

  // Atualiza status
  await db
    .from("hub_aprovacoes")
    .update({
      status: "aprovado",
      aprovado_por: "humano",
      aprovado_em: new Date().toISOString(),
      observacao,
    })
    .eq("id", aprovacaoId);

  // Registra no log de decisões
  await db.from("hub_decision_logs").insert({
    agente_slug: aprovacao.agente_slug,
    tipo: "aprovacao_humana",
    descricao: `Aprovado: ${aprovacao.descricao}`,
    lead_id: aprovacao.lead_id,
    valor_envolvido: aprovacao.valor_envolvido || 0,
    aprovado_por: "humano",
    resultado: "aprovado",
  });

  // Executa a ação aprovada
  await executarAcaoAprovada(aprovacao);

  return { sucesso: true };
}

// ── REJEITAR ──────────────────────────────────────────────────
export async function rejeitar(
  aprovacaoId: string,
  motivo: string
): Promise<{ sucesso: boolean; erro?: string }> {
  const db = supabase();

  const { data: aprovacao } = await db
    .from("hub_aprovacoes")
    .select("*")
    .eq("id", aprovacaoId)
    .single();

  if (!aprovacao) return { sucesso: false, erro: "Aprovação não encontrada" };

  await db
    .from("hub_aprovacoes")
    .update({
      status: "rejeitado",
      rejeitado_por: "humano",
      rejeitado_em: new Date().toISOString(),
      motivo_rejeicao: motivo,
    })
    .eq("id", aprovacaoId);

  await db.from("hub_decision_logs").insert({
    agente_slug: aprovacao.agente_slug,
    tipo: "rejeicao_humana",
    descricao: `Rejeitado: ${aprovacao.descricao}`,
    lead_id: aprovacao.lead_id,
    valor_envolvido: aprovacao.valor_envolvido || 0,
    aprovado_por: "humano",
    resultado: `rejeitado: ${motivo}`,
  });

  // Notifica o agente que a ação foi rejeitada para refazer
  await db.from("hub_fila_mensagens").insert({
    lead_id: aprovacao.lead_id || "sistema",
    agente_id: aprovacao.agente_slug,
    canal: "interno",
    direcao: "entrada",
    conteudo: `AÇÃO REJEITADA: ${aprovacao.descricao}. Motivo: ${motivo}. Por favor, refaça com as correções necessárias.`,
    status: "pendente",
    metadata: { tipo: "rejeicao", aprovacao_id: aprovacaoId },
  });

  return { sucesso: true };
}

// ── CRIAR APROVAÇÃO ───────────────────────────────────────────
export async function criarAprovacao(dados: {
  tipo: TipoAprovacao;
  agenteSlug: string;
  descricao: string;
  motivo: string;
  impacto: string;
  recomendacao?: string;
  confiancaIA?: number;
  leadId?: string;
  valorEnvolvido?: number;
  prazo?: string;
  dados?: Record<string, unknown>;
}): Promise<string | null> {
  const db = supabase();

  const { data, error } = await db
    .from("hub_aprovacoes")
    .insert({
      tipo: dados.tipo,
      agente_slug: dados.agenteSlug,
      descricao: dados.descricao,
      motivo: dados.motivo,
      impacto: dados.impacto,
      recomendacao: dados.recomendacao || "IA recomenda aprovação",
      confianca_ia: dados.confiancaIA || 85,
      lead_id: dados.leadId,
      valor_envolvido: dados.valorEnvolvido,
      prazo: dados.prazo,
      dados: dados.dados || {},
      status: "pendente",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[APROVAÇÕES] Erro ao criar:", error);
    return null;
  }

  return data?.id || null;
}

// ── EXECUTAR AÇÃO APROVADA ────────────────────────────────────
async function executarAcaoAprovada(aprovacao: Record<string, unknown>): Promise<void> {
  const dados = aprovacao.dados as Record<string, unknown> || {};
  const tipo = aprovacao.tipo as string;

  console.log(`[APROVAÇÕES] Executando ação aprovada: ${tipo}`, dados);

  // Aqui cada tipo de aprovação tem sua execução específica
  // Por enquanto registra no log — integração com APIs externas
  // (Meta Ads, WhatsApp Business, etc.) será adicionada por módulo
}
