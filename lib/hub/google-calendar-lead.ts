import type { SupabaseClient } from "@supabase/supabase-js";

export type LeadGcalReserva = {
  event_id: string;
  inicio: string | null;
  fim: string | null;
  link_calendario: string | null;
  link_meet: string | null;
  criado_em: string;
};

export async function gravarReservaGcalNoLead(
  supabase: SupabaseClient,
  leadId: string,
  reserva: Omit<LeadGcalReserva, "criado_em">
): Promise<void> {
  const { data } = await supabase.from("hub_leads_crm").select("metadata").eq("id", leadId).maybeSingle();
  const meta =
    data?.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
      ? { ...(data.metadata as Record<string, unknown>) }
      : {};
  const prev = Array.isArray(meta.google_calendar_reservas)
    ? (meta.google_calendar_reservas as LeadGcalReserva[])
    : [];
  const next: LeadGcalReserva[] = [
    ...prev.filter((r) => r.event_id !== reserva.event_id),
    { ...reserva, criado_em: new Date().toISOString() },
  ];
  await supabase
    .from("hub_leads_crm")
    .update({
      metadata: { ...meta, google_calendar_reservas: next, google_calendar_ultimo_event_id: reserva.event_id },
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", leadId);
}

export async function removerReservaGcalDoLead(
  supabase: SupabaseClient,
  leadId: string,
  eventId: string
): Promise<void> {
  const { data } = await supabase.from("hub_leads_crm").select("metadata").eq("id", leadId).maybeSingle();
  const meta =
    data?.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
      ? { ...(data.metadata as Record<string, unknown>) }
      : {};
  const prev = Array.isArray(meta.google_calendar_reservas)
    ? (meta.google_calendar_reservas as LeadGcalReserva[])
    : [];
  const next = prev.filter((r) => r.event_id !== eventId);
  const ultimo = next.length > 0 ? next[next.length - 1]!.event_id : null;
  await supabase
    .from("hub_leads_crm")
    .update({
      metadata: { ...meta, google_calendar_reservas: next, google_calendar_ultimo_event_id: ultimo },
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", leadId);
}

export function reservasLeadParaRespostaCliente(reservas: LeadGcalReserva[]): Record<string, unknown> {
  const ativas = reservas.filter((r) => r.event_id);
  return {
    total: ativas.length,
    reservas: ativas.map((r) => ({
      inicio: r.inicio,
      fim: r.fim,
      link: r.link_meet || r.link_calendario,
    })),
  };
}
