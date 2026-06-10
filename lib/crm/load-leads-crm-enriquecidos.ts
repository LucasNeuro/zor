import type { SupabaseClient } from "@supabase/supabase-js";

export type LeadCrmEnriquecidoRow = Record<string, unknown>;

function extractErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return String(error ?? "");
  const e = error as { message?: string; details?: string; hint?: string; code?: string };
  return [e.message, e.details, e.hint, e.code].filter(Boolean).join(" ");
}

async function enrichWithPessoa(
  supabase: SupabaseClient,
  rows: LeadCrmEnriquecidoRow[]
): Promise<LeadCrmEnriquecidoRow[]> {
  const pids = [...new Set(rows.map((r) => r.pessoa_id).filter(Boolean))] as string[];
  if (!pids.length) return rows;

  const { data: pes } = await supabase
    .from("hub_pessoas")
    .select("id, codigo, email, nome, cidade, estado")
    .in("id", pids);

  const map = new Map<string, Record<string, unknown>>();
  for (const p of pes ?? []) {
    map.set(String(p.id), p as Record<string, unknown>);
  }

  return rows.map((r) => {
    const pe = r.pessoa_id ? map.get(String(r.pessoa_id)) : undefined;
    const emailLead = r.email != null ? String(r.email).trim() : "";
    const emailP = pe?.email != null ? String(pe.email).trim() : "";
    return {
      ...r,
      pessoa_codigo: pe?.codigo ?? null,
      pessoa_nome_completo: pe?.nome ?? null,
      pessoa_cidade: pe?.cidade ?? null,
      pessoa_estado: pe?.estado ?? null,
      email_exibicao: emailLead || emailP || null,
      _pessoa_codigo: pe?.codigo != null ? String(pe.codigo) : null,
    };
  });
}

async function enrichWithUltimaMensagem(
  supabase: SupabaseClient,
  rows: LeadCrmEnriquecidoRow[]
): Promise<LeadCrmEnriquecidoRow[]> {
  const ids = rows.map((r) => (r.id != null ? String(r.id) : "")).filter(Boolean);
  if (!ids.length) return rows;

  const { data: msgs } = await supabase
    .from("hub_fila_mensagens")
    .select("lead_id, conteudo, criado_em")
    .in("lead_id", ids)
    .order("criado_em", { ascending: false });

  const lastByLead = new Map<string, { conteudo: string; criado_em: string }>();
  for (const m of msgs ?? []) {
    const lid = m.lead_id != null ? String(m.lead_id) : "";
    if (!lid || lastByLead.has(lid)) continue;
    lastByLead.set(lid, {
      conteudo: String(m.conteudo ?? ""),
      criado_em: String(m.criado_em ?? ""),
    });
  }

  return rows.map((r) => {
    const last = lastByLead.get(String(r.id));
    if (!last) return r;
    return {
      ...r,
      ultima_mensagem_fila: r.ultima_mensagem_fila ?? last.conteudo,
      ultima_mensagem_fila_em: r.ultima_mensagem_fila_em ?? last.criado_em,
    };
  });
}

async function loadFromBaseTable(
  supabase: SupabaseClient,
  tenantFilter: string
): Promise<{ rows: LeadCrmEnriquecidoRow[]; error?: string }> {
  const { data: baseRows, error: baseError } = await supabase
    .from("hub_leads_crm")
    .select("*")
    .or(tenantFilter)
    .order("atualizado_em", { ascending: false });

  if (baseError) {
    return { rows: [], error: extractErrorMessage(baseError) };
  }

  let rows = (baseRows ?? []) as LeadCrmEnriquecidoRow[];
  rows = await enrichWithPessoa(supabase, rows);
  rows = await enrichWithUltimaMensagem(supabase, rows);
  return { rows };
}

type LoadOpts = {
  /** Evita consultar a view (útil quando vw_hub_leads_crm_enriquecido não existe no Supabase). */
  skipView?: boolean;
};

/** Carrega leads enriquecidos (view opcional ou hub_leads_crm + pessoa + fila). */
export async function loadLeadsCrmEnriquecidos(
  supabase: SupabaseClient,
  tenantFilter: string,
  opts?: LoadOpts
): Promise<{ rows: LeadCrmEnriquecidoRow[]; error?: string; source?: "view" | "base" }> {
  if (!opts?.skipView) {
    const { data, error } = await supabase
      .from("vw_hub_leads_crm_enriquecido")
      .select("*")
      .or(tenantFilter)
      .order("atualizado_em", { ascending: false });

    if (!error) {
      return { rows: (data ?? []) as LeadCrmEnriquecidoRow[], source: "view" };
    }

    // Qualquer falha na view → fallback silencioso para hub_leads_crm
    const fallback = await loadFromBaseTable(supabase, tenantFilter);
    return { ...fallback, source: "base" };
  }

  const base = await loadFromBaseTable(supabase, tenantFilter);
  return { ...base, source: "base" };
}

export function leadTemConversaAtiva(
  row: LeadCrmEnriquecidoRow,
  leadIdsComMensagem: Set<string>
): boolean {
  const id = row.id != null ? String(row.id) : "";
  if (id && leadIdsComMensagem.has(id)) return true;

  const humano = row.humano_responsavel != null ? String(row.humano_responsavel).trim() : "";
  const agente = row.agente_responsavel != null ? String(row.agente_responsavel).trim() : "";
  const ultimaMsgEm = row.ultima_mensagem_fila_em ?? row.ultimo_contato;
  const ultimaMsgTxt = row.ultima_mensagem_fila ?? row.ultima_mensagem;

  return Boolean(
    humano ||
      agente ||
      ultimaMsgEm ||
      (ultimaMsgTxt != null && String(ultimaMsgTxt).trim())
  );
}
