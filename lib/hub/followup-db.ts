import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FOLLOWUP_PASSOS_DEFAULT,
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
  const passosInsert = FOLLOWUP_PASSOS_DEFAULT.map((p) => ({
    config_id: config.id,
    tenant_id: tenantId,
    agente_slug: agenteSlug,
    ordem: p.ordem,
    atraso_horas: p.atraso_horas,
    tipo_conteudo: p.tipo_conteudo,
    texto_template: p.texto_template,
    ativo: true,
  }));

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
