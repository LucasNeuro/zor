import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AGENDA_LEMBRETE_MINUTOS_PADRAO,
  AGENDA_LEMBRETE_TEMPLATE_PADRAO,
  normalizarAgendaLembreteConfig,
  type HubAgenteAgendaLembreteConfig,
} from "@/lib/hub/agenda-lembrete-types";
import { TZ_FOLLOWUP_PADRAO } from "@/lib/hub/followup-janela";

export async function obterOuCriarAgendaLembreteConfig(
  supabase: SupabaseClient,
  agenteSlug: string,
  tenantId: string | null
): Promise<HubAgenteAgendaLembreteConfig | null> {
  const slug = agenteSlug.trim();
  const { data: existente } = await supabase
    .from("hub_agente_agenda_lembrete_config")
    .select("*")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (existente) {
    return normalizarAgendaLembreteConfig(existente as HubAgenteAgendaLembreteConfig);
  }

  const row: Record<string, unknown> = {
    agente_slug: slug,
    ativo: false,
    minutos_antes: AGENDA_LEMBRETE_MINUTOS_PADRAO,
    texto_template: AGENDA_LEMBRETE_TEMPLATE_PADRAO,
    timezone: TZ_FOLLOWUP_PADRAO,
  };
  if (tenantId) row.tenant_id = tenantId;

  const { data: criado, error } = await supabase
    .from("hub_agente_agenda_lembrete_config")
    .insert(row)
    .select("*")
    .single();

  if (error || !criado) return null;
  return normalizarAgendaLembreteConfig(criado as HubAgenteAgendaLembreteConfig);
}

export async function agendaLembreteJaEnviado(
  supabase: SupabaseClient,
  leadId: string,
  eventId: string
): Promise<{ jaEnviado: boolean; ledgerOk: boolean }> {
  const { data, error } = await supabase
    .from("hub_agenda_lembrete_envio")
    .select("id")
    .eq("lead_id", leadId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.warn("[agenda-lembrete] ledger check:", error.message);
    return { jaEnviado: false, ledgerOk: false };
  }
  return { jaEnviado: data != null, ledgerOk: true };
}

export async function registrarAgendaLembreteEnvio(
  supabase: SupabaseClient,
  params: {
    lead_id: string;
    event_id: string;
    agente_slug: string;
    tenant_id: string | null;
    enviado_em?: string;
  }
): Promise<{ ok: boolean; erro?: string }> {
  const { error } = await supabase.from("hub_agenda_lembrete_envio").insert({
    lead_id: params.lead_id,
    event_id: params.event_id,
    agente_slug: params.agente_slug,
    tenant_id: params.tenant_id,
    enviado_em: params.enviado_em ?? new Date().toISOString(),
  });

  if (error) {
    if (/duplicate|unique|23505/i.test(error.message)) {
      return { ok: true };
    }
    return { ok: false, erro: error.message };
  }
  return { ok: true };
}
