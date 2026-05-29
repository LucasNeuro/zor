import type { SupabaseClient } from "@supabase/supabase-js";
import { limparSessaoConversaExpirada } from "@/lib/ia/sessao-conversa-ttl";

export type LimparMemoriasAgenteResult = {
  memoriasRemovidas: number;
  briefingSessoesRemovidas: number;
  leadsResetados: number;
  memoriasLeadRemovidas: number;
};

export type LimparMemoriasAgenteContagem = {
  memorias: number;
  briefingSessoes: number;
  leads: number;
  memoriasLead: number;
};

export async function contarMemoriasAgente(
  supabase: SupabaseClient,
  agenteSlug: string
): Promise<LimparMemoriasAgenteContagem> {
  const slug = agenteSlug.trim();
  let memorias = 0;
  let briefingSessoes = 0;

  const { count: memCount, error: memErr } = await supabase
    .from("hub_memorias_agente")
    .select("id", { count: "exact", head: true })
    .eq("agente_slug", slug);

  if (!memErr && typeof memCount === "number") memorias = memCount;

  const { count: briefCount, error: briefErr } = await supabase
    .from("hub_crm_agente_briefing_sessao")
    .select("id", { count: "exact", head: true })
    .eq("agente_slug", slug);

  if (!briefErr && typeof briefCount === "number") briefingSessoes = briefCount;

  const { data: leads, error: leadsErr } = await supabase
    .from("hub_leads_crm")
    .select("id")
    .eq("agente_responsavel", slug);

  let leadsCount = 0;
  let memoriasLead = 0;
  if (!leadsErr && Array.isArray(leads)) {
    leadsCount = leads.length;
    const leadIds = leads.map((l) => l.id).filter(Boolean);
    if (leadIds.length > 0) {
      const { count: memLeadCount, error: memLeadErr } = await supabase
        .from("hub_memorias_lead")
        .select("id", { count: "exact", head: true })
        .in("lead_id", leadIds);
      if (!memLeadErr && typeof memLeadCount === "number") memoriasLead = memLeadCount;
    }
  }

  return { memorias, briefingSessoes, leads: leadsCount, memoriasLead };
}

async function limparEstadoLeadsDoAgente(
  supabase: SupabaseClient,
  agenteSlug: string
): Promise<{ leadsResetados: number; memoriasLeadRemovidas: number }> {
  const slug = agenteSlug.trim();
  const { data: leads, error } = await supabase
    .from("hub_leads_crm")
    .select("id")
    .eq("agente_responsavel", slug);

  if (error) throw new Error(error.message);

  let leadsResetados = 0;
  let memoriasLeadRemovidas = 0;

  for (const lead of leads ?? []) {
    const leadId = typeof lead.id === "string" ? lead.id : String(lead.id ?? "");
    if (!leadId) continue;

    const { count: antes, error: countErr } = await supabase
      .from("hub_memorias_lead")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", leadId);

    if (!countErr && typeof antes === "number") memoriasLeadRemovidas += antes;

    await limparSessaoConversaExpirada(supabase, leadId);
    leadsResetados += 1;
  }

  return { leadsResetados, memoriasLeadRemovidas };
}

/** Apaga memórias operacionais do agente e, opcionalmente, sessões do briefing interno. */
export async function limparMemoriasAgente(
  supabase: SupabaseClient,
  agenteSlug: string,
  opts?: { incluirBriefing?: boolean }
): Promise<LimparMemoriasAgenteResult> {
  const slug = agenteSlug.trim();
  const incluirBriefing = opts?.incluirBriefing !== false;

  let memoriasRemovidas = 0;
  let briefingSessoesRemovidas = 0;

  const { data: memRows, error: memErr } = await supabase
    .from("hub_memorias_agente")
    .delete()
    .eq("agente_slug", slug)
    .select("id");

  if (memErr) {
    if (!memErr.message.includes("hub_memorias_agente") || !memErr.message.includes("does not exist")) {
      throw new Error(memErr.message);
    }
  } else {
    memoriasRemovidas = memRows?.length ?? 0;
  }

  if (incluirBriefing) {
    const { data: briefRows, error: briefErr } = await supabase
      .from("hub_crm_agente_briefing_sessao")
      .delete()
      .eq("agente_slug", slug)
      .select("id");

    if (briefErr) {
      if (
        !briefErr.message.includes("hub_crm_agente_briefing_sessao") ||
        !briefErr.message.includes("does not exist")
      ) {
        throw new Error(briefErr.message);
      }
    } else {
      briefingSessoesRemovidas = briefRows?.length ?? 0;
    }
  }

  const { leadsResetados, memoriasLeadRemovidas } = await limparEstadoLeadsDoAgente(supabase, slug);

  return { memoriasRemovidas, briefingSessoesRemovidas, leadsResetados, memoriasLeadRemovidas };
}
