import type { SupabaseClient } from "@supabase/supabase-js";

/** Janela de contexto ativo (horas). Env: HUB_SESSAO_CONVERSA_TTL_HORAS (default 12). */
export function sessaoConversaTtlMs(): number {
  const raw = process.env.HUB_SESSAO_CONVERSA_TTL_HORAS?.trim();
  const hours = raw ? Number.parseFloat(raw) : 12;
  if (!Number.isFinite(hours) || hours <= 0) return 12 * 60 * 60 * 1000;
  return Math.min(168, Math.max(1, hours)) * 60 * 60 * 1000;
}

export function parseAtividadeMs(iso?: string | null): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

export function ultimaAtividadeMs(timestamps: number[]): number {
  const valid = timestamps.filter((t) => t > 0);
  return valid.length ? Math.max(...valid) : 0;
}

/** Sem atividade prévia → sessão nova; com gap > TTL → reiniciar contexto. */
export function sessaoConversaExpirada(ultimaAtividadeMs: number, agoraMs = Date.now()): boolean {
  if (ultimaAtividadeMs <= 0) return false;
  return agoraMs - ultimaAtividadeMs > sessaoConversaTtlMs();
}

export function cutoffSessaoConversaMs(agoraMs = Date.now()): number {
  return agoraMs - sessaoConversaTtlMs();
}

export type LinhaComAtividade = {
  role: "user" | "assistant";
  content: string;
  criadoEm?: string;
};

export function filtrarLinhasHistoricoNaSessao<T extends LinhaComAtividade>(
  linhas: T[],
  agoraMs = Date.now()
): T[] {
  const cutoff = cutoffSessaoConversaMs(agoraMs);
  return linhas.filter((l) => {
    const t = parseAtividadeMs(l.criadoEm);
    return t <= 0 || t >= cutoff;
  });
}

const CHAVES_METADATA_SESSAO = [
  "conversa_turnos",
  "fluxo_ativo",
  "fluxo1",
  "fluxo2",
  "fluxo3",
  "fluxo_arquitetura",
  "etapa",
  "triagem_feita",
  "triagem_escolha",
  "menu_enviado",
  "potencial",
  "fase_atendimento",
  "lead_kind",
  "servico_solicitado",
  "modo_imobiliario",
  "intencao_imobiliario",
  "intencao_imob_sub",
  "intencao_proprietario",
  "tipo_imovel_projeto",
  "tamanho_imovel",
  "cidade_bairro_projeto",
  "cidade_bairro_imovel",
  "valor_imovel",
  "caracteristicas_adicionais",
  "primeira_mensagem",
  "wa_playbook_complete",
  "sessao_reiniciada_em",
] as const;

/** Remove estado conversacional + playbook Maria + menu WhatsApp do metadata do lead. */
export function limparMetadataConversacional(
  meta: Record<string, unknown>,
  opts?: { preservarConversaTurnos?: boolean }
): Record<string, unknown> {
  const out = { ...meta };
  for (const k of CHAVES_METADATA_SESSAO) {
    if (opts?.preservarConversaTurnos && k === "conversa_turnos") continue;
    delete out[k];
  }
  for (const key of Object.keys(out)) {
    if (/^fluxo/i.test(key) && key !== "fluxo_id") delete out[key];
    if (/^wa_playbook_/i.test(key)) delete out[key];
    if (/^wa_menu_triagem/i.test(key)) delete out[key];
    if (/^arq_/i.test(key)) delete out[key];
    if (/^imob_/i.test(key)) delete out[key];
    if (/^prop_/i.test(key)) delete out[key];
    if (/^parc_/i.test(key)) delete out[key];
  }
  return out;
}

function limparChavesSessaoMetadata(
  meta: Record<string, unknown>,
  opts?: { preservarConversaTurnos?: boolean }
): Record<string, unknown> {
  return limparMetadataConversacional(meta, opts);
}

/** Campos do lead que alimentam contexto da IA — limpos ao reiniciar sessão (mantém nome, telefone, estágio CRM). */
function patchLeadCamposSessao(
  metaBase: Record<string, unknown>,
  opts?: { preservarConversaTurnos?: boolean }
): Record<string, unknown> {
  return {
    metadata: {
      ...limparChavesSessaoMetadata(metaBase, opts),
      sessao_reiniciada_em: new Date().toISOString(),
    },
    interesse_principal: null,
    valor_estimado: 0,
    proxima_acao: null,
    data_proxima_acao: null,
    atualizado_em: new Date().toISOString(),
  };
}

/** Remove turnos, fluxo, interesse e memórias IA da sessão anterior (histórico em hub_mensagens permanece). */
export async function limparSessaoConversaExpirada(
  supabase: SupabaseClient,
  leadId: string,
  opts?: { preservarConversaTurnos?: boolean }
): Promise<void> {
  const { data: atual } = await supabase
    .from("hub_leads_crm")
    .select("metadata, preferencias")
    .eq("id", leadId)
    .maybeSingle();

  const metaBase =
    atual?.metadata && typeof atual.metadata === "object" && !Array.isArray(atual.metadata)
      ? (atual.metadata as Record<string, unknown>)
      : {};

  const patch = patchLeadCamposSessao(metaBase, opts);
  if (atual && "preferencias" in atual) {
    patch.preferencias = null;
  }

  const { error: upErr } = await supabase.from("hub_leads_crm").update(patch).eq("id", leadId);

  if (upErr) {
    const msg = upErr.message || "";
    if (/interesse_principal|preferencias|column/i.test(msg)) {
      const { error: upMin } = await supabase
        .from("hub_leads_crm")
        .update({
          metadata: patch.metadata,
          valor_estimado: 0,
          proxima_acao: null,
          data_proxima_acao: null,
          atualizado_em: patch.atualizado_em,
        })
        .eq("id", leadId);
      if (upMin) console.warn("[SESSAO] limpar lead (mínimo):", upMin.message);
    } else {
      console.warn("[SESSAO] limpar lead:", msg);
    }
  }

  const { error: memErr } = await supabase.from("hub_memorias_lead").delete().eq("lead_id", leadId);

  if (memErr) console.warn("[SESSAO] limpar memorias:", memErr.message);
}

export async function obterUltimaAtividadeLeadMs(
  supabase: SupabaseClient,
  leadId: string,
  turnosAt?: Array<{ at?: string }>
): Promise<number> {
  const fromTurnos = ultimaAtividadeMs((turnosAt ?? []).map((t) => parseAtividadeMs(t.at)));

  const { data: lead } = await supabase
    .from("hub_leads_crm")
    .select("ultima_mensagem_em, atualizado_em")
    .eq("id", leadId)
    .maybeSingle();

  const fromLead = ultimaAtividadeMs([
    parseAtividadeMs(lead?.ultima_mensagem_em as string | undefined),
    parseAtividadeMs(lead?.atualizado_em as string | undefined),
  ]);

  const { data: msg } = await supabase
    .from("hub_mensagens")
    .select("enviada_em, criado_em")
    .eq("lead_id", leadId)
    .order("enviada_em", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const fromMsg = msg
    ? ultimaAtividadeMs([
        parseAtividadeMs(msg.enviada_em as string | undefined),
        parseAtividadeMs(msg.criado_em as string | undefined),
      ])
    : 0;

  return ultimaAtividadeMs([fromTurnos, fromLead, fromMsg]);
}

/** Se a sessão expirou, limpa estado conversacional antes de novo atendimento. */
export async function garantirSessaoConversaAtiva(
  supabase: SupabaseClient,
  leadId: string,
  turnosAt?: Array<{ at?: string }>
): Promise<{ reiniciada: boolean }> {
  const ultima = await obterUltimaAtividadeLeadMs(supabase, leadId, turnosAt);
  if (!sessaoConversaExpirada(ultima)) {
    return { reiniciada: false };
  }
  await limparSessaoConversaExpirada(supabase, leadId);
  return { reiniciada: true };
}
