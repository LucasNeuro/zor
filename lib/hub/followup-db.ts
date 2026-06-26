import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FOLLOWUP_PASSOS_DEFAULT,
  minutosToLegacyAtraso,
  passosAtivosOrdenados,
  passosEnviadosCount,
  type HubAgenteFollowupConfig,
  type HubAgenteFollowupPasso,
} from "@/lib/hub/followup-types";

export async function obterOuCriarFollowupConfig(
  supabase: SupabaseClient,
  agenteSlug: string,
  tenantId: string | null
): Promise<{ config: HubAgenteFollowupConfig; passos: HubAgenteFollowupPasso[] } | null> {
  const { data: existente } = await supabase
    .from("hub_agente_followup_config")
    .select("*")
    .eq("agente_slug", agenteSlug)
    .maybeSingle();

  if (existente) {
    const { data: passos } = await supabase
      .from("hub_agente_followup_passo")
      .select("*")
      .eq("config_id", existente.id)
      .order("ordem");
    return {
      config: existente as HubAgenteFollowupConfig,
      passos: (passos || []) as HubAgenteFollowupPasso[],
    };
  }

  const row: Record<string, unknown> = {
    agente_slug: agenteSlug,
    ativo: false,
    arquivar_apos_dias: 7,
  };
  if (tenantId) row.tenant_id = tenantId;

  const { data: criado, error } = await supabase
    .from("hub_agente_followup_config")
    .insert(row)
    .select("*")
    .single();

  if (error || !criado) return null;

  const config = criado as HubAgenteFollowupConfig;
  const passosInsert = FOLLOWUP_PASSOS_DEFAULT.map((p) => {
    const leg = minutosToLegacyAtraso(p.espera_minutos);
    return {
      config_id: config.id,
      tenant_id: tenantId,
      agente_slug: agenteSlug,
      ordem: p.ordem,
      espera_minutos: p.espera_minutos,
      atraso_dias: leg.atraso_dias,
      atraso_horas: leg.atraso_horas,
      atraso_minutos: leg.atraso_minutos,
      tipo_conteudo: p.tipo_conteudo,
      texto_template: p.texto_template,
      ativo: true,
    };
  });

  const { data: passos } = await supabase
    .from("hub_agente_followup_passo")
    .insert(passosInsert)
    .select("*");

  return {
    config,
    passos: (passos || []) as HubAgenteFollowupPasso[],
  };
}

/** Cria config + 3 passos padrão na criação do agente WA (idempotente). */
export async function provisionHubAgenteFollowupConfig(
  supabase: SupabaseClient,
  agenteSlug: string,
  tenantId: string | null
): Promise<{ criado: boolean; erro?: string }> {
  const { data: existente, error: existErr } = await supabase
    .from("hub_agente_followup_config")
    .select("id")
    .eq("agente_slug", agenteSlug)
    .maybeSingle();

  if (existErr) return { criado: false, erro: existErr.message };
  if (existente) return { criado: false };

  const pack = await obterOuCriarFollowupConfig(supabase, agenteSlug, tenantId);
  if (!pack) return { criado: false, erro: "Não foi possível provisionar follow-up." };
  return { criado: true };
}

/** Renumera passos para ordem contígua 1..N (idempotente). */
export async function compactarOrdemPassosFollowup(
  supabase: SupabaseClient,
  agenteSlug: string
): Promise<{ passos: HubAgenteFollowupPasso[]; erro?: string }> {
  const { data: passos, error: listErr } = await supabase
    .from("hub_agente_followup_passo")
    .select("*")
    .eq("agente_slug", agenteSlug)
    .order("ordem");

  if (listErr) return { passos: [], erro: listErr.message };
  const lista = (passos || []) as HubAgenteFollowupPasso[];
  if (lista.length === 0) return { passos: [] };

  const ids = lista.map((p) => p.id);
  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabase
      .from("hub_agente_followup_passo")
      .update({ ordem: 1000 + i })
      .eq("id", ids[i]!)
      .eq("agente_slug", agenteSlug);
    if (error) return { passos: lista, erro: error.message };
  }

  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabase
      .from("hub_agente_followup_passo")
      .update({ ordem: i + 1 })
      .eq("id", ids[i]!)
      .eq("agente_slug", agenteSlug);
    if (error) return { passos: lista, erro: error.message };
  }

  const { data: atualizados, error: fetchErr } = await supabase
    .from("hub_agente_followup_passo")
    .select("*")
    .eq("agente_slug", agenteSlug)
    .order("ordem");

  if (fetchErr) return { passos: lista, erro: fetchErr.message };
  return { passos: (atualizados || []) as HubAgenteFollowupPasso[] };
}

/** Normaliza followup_passo nos leads após mudança na cadência (apaga buracos / legado por ordem). */
export async function reconciliarFollowupPassoLeadsAgente(
  supabase: SupabaseClient,
  agenteSlug: string,
  passos: HubAgenteFollowupPasso[]
): Promise<number> {
  const passosAtivos = passosAtivosOrdenados(passos);
  const maxEnviados = passosAtivos.length;

  const { data: leads, error } = await supabase
    .from("hub_leads_crm")
    .select("id, followup_passo")
    .eq("agente_responsavel", agenteSlug)
    .gt("followup_passo", 0);

  if (error || !leads?.length) return 0;

  let ajustados = 0;
  for (const lead of leads) {
    const normalizado = passosEnviadosCount(lead.followup_passo, passosAtivos);
    const capped = Math.min(normalizado, maxEnviados);
    if (capped !== lead.followup_passo) {
      const { error: upErr } = await supabase
        .from("hub_leads_crm")
        .update({ followup_passo: capped })
        .eq("id", lead.id);
      if (!upErr) ajustados += 1;
    }
  }

  return ajustados;
}
