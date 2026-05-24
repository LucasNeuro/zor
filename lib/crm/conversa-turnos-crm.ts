import type { SupabaseClient } from "@supabase/supabase-js";
import {
  filtrarLinhasHistoricoNaSessao,
  garantirSessaoConversaAtiva,
} from "@/lib/ia/sessao-conversa-ttl";

export type TurnoConversaCrm = {
  role: "user" | "assistant";
  content: string;
  at: string;
};

const MAX_TURNOS = 24;

function normalizarTurnos(raw: unknown): TurnoConversaCrm[] {
  if (!Array.isArray(raw)) return [];
  const out: TurnoConversaCrm[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const role = o.role === "assistant" ? "assistant" : o.role === "user" ? "user" : null;
    const content = typeof o.content === "string" ? o.content.trim() : "";
    if (!role || !content) continue;
    out.push({
      role,
      content: content.slice(0, 4000),
      at: typeof o.at === "string" ? o.at : new Date().toISOString(),
    });
  }
  return out.slice(-MAX_TURNOS);
}

export async function carregarTurnosConversaCrm(
  supabase: SupabaseClient,
  leadId: string
): Promise<TurnoConversaCrm[]> {
  const { data } = await supabase
    .from("hub_leads_crm")
    .select("metadata")
    .eq("id", leadId)
    .maybeSingle();

  const meta =
    data?.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
      ? (data.metadata as Record<string, unknown>)
      : {};
  const turnos = normalizarTurnos(meta.conversa_turnos);
  return filtrarLinhasHistoricoNaSessao(
    turnos.map((t) => ({ ...t, criadoEm: t.at }))
  ).map(({ role, content, at }) => ({ role, content, at }));
}

export async function salvarTurnosConversaCrm(
  supabase: SupabaseClient,
  leadId: string,
  turnos: TurnoConversaCrm[]
): Promise<void> {
  const { data: atual } = await supabase
    .from("hub_leads_crm")
    .select("metadata")
    .eq("id", leadId)
    .maybeSingle();

  const metaBase =
    atual?.metadata && typeof atual.metadata === "object" && !Array.isArray(atual.metadata)
      ? { ...(atual.metadata as Record<string, unknown>) }
      : {};

  const { error } = await supabase
    .from("hub_leads_crm")
    .update({
      metadata: { ...metaBase, conversa_turnos: turnos.slice(-MAX_TURNOS) },
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (error) console.warn("[CRM] salvarTurnosConversaCrm:", error.message);
}

/** Regista turno do utilizador antes da IA e evita duplicar a mensagem actual. */
export async function registarEntradaUsuarioCrm(
  supabase: SupabaseClient,
  leadId: string,
  mensagem: string
): Promise<TurnoConversaCrm[]> {
  const { data: metaRow } = await supabase
    .from("hub_leads_crm")
    .select("metadata")
    .eq("id", leadId)
    .maybeSingle();
  const meta =
    metaRow?.metadata && typeof metaRow.metadata === "object" && !Array.isArray(metaRow.metadata)
      ? (metaRow.metadata as Record<string, unknown>)
      : {};
  const turnosBrutos = normalizarTurnos(meta.conversa_turnos);
  await garantirSessaoConversaAtiva(supabase, leadId, turnosBrutos);

  let turnos = await carregarTurnosConversaCrm(supabase, leadId);
  const msg = mensagem.trim();
  if (!msg) return turnos;

  const ultimo = turnos[turnos.length - 1];
  if (!(ultimo?.role === "user" && ultimo.content === msg)) {
    turnos.push({ role: "user", content: msg, at: new Date().toISOString() });
    await salvarTurnosConversaCrm(supabase, leadId, turnos);
  }
  return turnos;
}

export async function registarRespostaAssistenteCrm(
  supabase: SupabaseClient,
  leadId: string,
  resposta: string
): Promise<void> {
  const turnos = await carregarTurnosConversaCrm(supabase, leadId);
  const txt = resposta.trim();
  if (!txt) return;
  const ultimo = turnos[turnos.length - 1];
  if (ultimo?.role === "assistant" && ultimo.content === txt) return;
  turnos.push({ role: "assistant", content: txt, at: new Date().toISOString() });
  await salvarTurnosConversaCrm(supabase, leadId, turnos);
}

/** Turnos anteriores à mensagem actual (para fluxo «continuar conversa»). */
export function contarTurnosAnteriores(turnos: TurnoConversaCrm[], mensagemAtual: string): number {
  const msg = mensagemAtual.trim();
  let n = turnos.length;
  const ultimo = turnos[n - 1];
  if (ultimo?.role === "user" && ultimo.content.trim() === msg) n -= 1;
  return Math.max(0, n);
}

export function turnosParaMensagensLlm(
  turnos: TurnoConversaCrm[],
  mensagemAtual: string
): Array<{ role: "user" | "assistant"; content: string }> {
  const msg = mensagemAtual.trim();
  const out: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const t of turnos) {
    out.push({ role: t.role, content: t.content });
  }
  const ultimo = out[out.length - 1];
  if (!(ultimo?.role === "user" && ultimo.content.trim() === msg)) {
    out.push({ role: "user", content: mensagemAtual });
  }
  return out;
}
