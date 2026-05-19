import type { SupabaseClient } from "@supabase/supabase-js";
import { resumirConversaViaLlm } from "@/lib/ia/memoria-llm";
import {
  carregarResumoConversa,
  salvarResumoConversa,
} from "@/lib/ia/memoria-lead";

export type HistoricoConversaLinha = {
  role: "user" | "assistant";
  content: string;
  criadoEm?: string;
};

export type HistoricoConversaResultado = {
  linhas: HistoricoConversaLinha[];
  resumoAnterior?: string;
};

/** Limite de mensagens de contexto (2–24). Env: HUB_ENGINE_HISTORICO_MENSAGENS */
export function historicoConversaLimite(): number {
  const raw = process.env.HUB_ENGINE_HISTORICO_MENSAGENS?.trim();
  if (!raw) return 10;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return 10;
  return Math.min(24, Math.max(2, n));
}

/** A partir de quantas mensagens gerar resumo automático. Env: HUB_CONVERSA_RESUMO_APARTIR */
export function conversaResumoApartirDe(): number {
  const raw = process.env.HUB_CONVERSA_RESUMO_APARTIR?.trim();
  if (!raw) return 30;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return 30;
  return Math.min(200, Math.max(12, n));
}

function mapFila(
  rows: Array<{ conteudo: unknown; direcao: unknown; criado_em?: string | null }>
): HistoricoConversaLinha[] {
  return rows.map((h) => ({
    role: h.direcao === "entrada" ? "user" : "assistant",
    content: String(h.conteudo ?? "").trim(),
    criadoEm: h.criado_em ?? undefined,
  }));
}

function mapMensagens(
  rows: Array<{ conteudo: unknown; remetente: unknown; enviada_em?: string | null; criado_em?: string | null }>
): HistoricoConversaLinha[] {
  return rows.map((m) => ({
    role: m.remetente === "lead" || m.remetente === "user" ? "user" : "assistant",
    content: String(m.conteudo ?? "").trim(),
    criadoEm: m.enviada_em ?? m.criado_em ?? undefined,
  }));
}

function dedupeHistorico(linhas: HistoricoConversaLinha[]): HistoricoConversaLinha[] {
  const out: HistoricoConversaLinha[] = [];
  const seen = new Set<string>();
  for (const l of linhas) {
    const content = l.content.trim();
    if (!content) continue;
    const key = `${l.role}::${content.slice(0, 180)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ role: l.role, content });
  }
  return out;
}

async function buscarTodasLinhasConversa(
  supabase: SupabaseClient,
  leadId: string,
  max = 120
): Promise<HistoricoConversaLinha[]> {
  const { data: fila } = await supabase
    .from("hub_fila_mensagens")
    .select("conteudo, direcao, criado_em")
    .eq("lead_id", leadId)
    .order("criado_em", { ascending: true })
    .limit(max);

  let linhas = mapFila((fila ?? []) as Array<{ conteudo: unknown; direcao: unknown; criado_em?: string | null }>);

  if (linhas.length < 8) {
    const { data: msgs } = await supabase
      .from("hub_mensagens")
      .select("conteudo, remetente, enviada_em, criado_em")
      .eq("lead_id", leadId)
      .order("enviada_em", { ascending: true, nullsFirst: false })
      .limit(max);

    const extra = mapMensagens(
      (msgs ?? []) as Array<{
        conteudo: unknown;
        remetente: unknown;
        enviada_em?: string | null;
        criado_em?: string | null;
      }>
    );
    linhas = dedupeHistorico([...extra, ...linhas]);
  } else {
    linhas = dedupeHistorico(linhas);
  }

  return linhas;
}

async function contarMensagensConversa(supabase: SupabaseClient, leadId: string): Promise<number> {
  const { count: c1 } = await supabase
    .from("hub_fila_mensagens")
    .select("*", { count: "exact", head: true })
    .eq("lead_id", leadId);
  if ((c1 ?? 0) >= conversaResumoApartirDe()) return c1 ?? 0;

  const { count: c2 } = await supabase
    .from("hub_mensagens")
    .select("*", { count: "exact", head: true })
    .eq("lead_id", leadId);

  return Math.max(c1 ?? 0, c2 ?? 0);
}

/**
 * Histórico recente + resumo automático quando conversa >= HUB_CONVERSA_RESUMO_APARTIR (default 30).
 */
export async function buscarHistoricoConversa(
  supabase: SupabaseClient,
  params: { leadId: string; limite?: number }
): Promise<HistoricoConversaResultado> {
  const limite = params.limite ?? historicoConversaLimite();
  const total = await contarMensagensConversa(supabase, params.leadId);
  const limiarResumo = conversaResumoApartirDe();

  if (total < limiarResumo) {
    const todas = await buscarTodasLinhasConversa(supabase, params.leadId, 48);
    return { linhas: todas.slice(-limite) };
  }

  const todas = await buscarTodasLinhasConversa(supabase, params.leadId, 150);
  const recentes = todas.slice(-limite);
  const antigas = todas.slice(0, Math.max(0, todas.length - limite));

  let resumoAnterior: string | undefined;
  const resumoSalvo = await carregarResumoConversa(supabase, params.leadId);
  const precisaRegenerar =
    !resumoSalvo ||
    total - (resumoSalvo.total_mensagens ?? 0) >= 10 ||
    !resumoSalvo.texto?.trim();

  if (precisaRegenerar && antigas.length >= 6) {
    const novo = await resumirConversaViaLlm(antigas);
    if (novo) {
      await salvarResumoConversa(supabase, params.leadId, novo, total);
      resumoAnterior = novo;
    } else if (resumoSalvo?.texto) {
      resumoAnterior = resumoSalvo.texto;
    }
  } else if (resumoSalvo?.texto) {
    resumoAnterior = resumoSalvo.texto;
  }

  return { linhas: recentes, resumoAnterior };
}

/** Formata bloco de contexto para injectar no system prompt. */
export function formatarBlocoContextoConversa(linhas: HistoricoConversaLinha[]): string {
  if (!linhas.length) return "";
  const corpo = linhas
    .map((l) => `${l.role === "user" ? "Cliente" : "Assistente"}: ${l.content}`)
    .join("\n");
  return `═══ CONTEXTO RECENTE DA CONVERSA ═══
Use para continuidade; não repita informação já dada salvo se o cliente pedir.

${corpo}`;
}
