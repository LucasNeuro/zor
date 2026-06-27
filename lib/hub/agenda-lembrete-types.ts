import { interpolarTemplateFollowup, type FollowupTemplateVars } from "@/lib/hub/followup-types";
import type { LeadGcalReserva } from "@/lib/hub/google-calendar-lead";
import { TZ_FOLLOWUP_PADRAO } from "@/lib/hub/followup-janela";

export type HubAgenteAgendaLembreteConfig = {
  id: string;
  tenant_id: string | null;
  agente_slug: string;
  ativo: boolean;
  minutos_antes: number;
  texto_template: string;
  timezone: string;
  criado_em?: string;
  atualizado_em?: string;
};

export const AGENDA_LEMBRETE_TEMPLATE_PADRAO =
  "Oi {nome}, lembrando: sua reunião com {agente} começa às {hora}. Link: {link_meet}";

export const AGENDA_LEMBRETE_MINUTOS_PADRAO = 10;

export type AgendaLembreteTemplateVars = FollowupTemplateVars & {
  hora: string;
  data: string;
  link_meet: string;
  link: string;
};

export function timezoneAgendaLembrete(config: Pick<HubAgenteAgendaLembreteConfig, "timezone">): string {
  const tz = config.timezone?.trim();
  return tz || TZ_FOLLOWUP_PADRAO;
}

export function formatarHoraAgenda(iso: string, timezone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function formatarDataAgenda(iso: string, timezone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function interpolarTemplateAgendaLembrete(
  template: string,
  vars: AgendaLembreteTemplateVars
): string {
  const base = interpolarTemplateFollowup(template, vars);
  const linkMeet = (vars.link_meet || vars.link || "").trim() || "—";
  const link = (vars.link || vars.link_meet || "").trim() || "—";
  return base
    .replace(/\{hora\}/gi, vars.hora || "—")
    .replace(/\{data\}/gi, vars.data || "—")
    .replace(/\{link_meet\}/gi, linkMeet)
    .replace(/\{link\}/gi, link);
}

/** Reservas válidas no metadata do lead. */
export function reservasAgendaDoLead(metadata: unknown): LeadGcalReserva[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const raw = (metadata as Record<string, unknown>).google_calendar_reservas;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is LeadGcalReserva => !!r && typeof r === "object" && typeof (r as LeadGcalReserva).event_id === "string")
    .map((r) => ({
      event_id: String(r.event_id).trim(),
      inicio: typeof r.inicio === "string" ? r.inicio : null,
      fim: typeof r.fim === "string" ? r.fim : null,
      link_calendario: typeof r.link_calendario === "string" ? r.link_calendario : null,
      link_meet: typeof r.link_meet === "string" ? r.link_meet : null,
      criado_em: typeof r.criado_em === "string" ? r.criado_em : "",
    }))
    .filter((r) => r.event_id.length > 0);
}

/**
 * Dispara lembrete quando faltam entre 0 e minutosAntes para o início (inclusive).
 * O ledger garante envio único por event_id.
 */
export function reservaNaJanelaLembrete(
  inicioIso: string,
  agoraMs: number,
  minutosAntes: number
): boolean {
  const inicioMs = new Date(inicioIso).getTime();
  if (Number.isNaN(inicioMs)) return false;
  const diffMs = inicioMs - agoraMs;
  if (diffMs <= 0) return false;
  const limiteMs = Math.max(1, minutosAntes) * 60 * 1000;
  return diffMs <= limiteMs;
}

export function normalizarAgendaLembreteConfig(
  c: Partial<HubAgenteAgendaLembreteConfig> & Pick<HubAgenteAgendaLembreteConfig, "id" | "agente_slug">
): HubAgenteAgendaLembreteConfig {
  const minutos = Number.isFinite(c.minutos_antes) ? c.minutos_antes! : AGENDA_LEMBRETE_MINUTOS_PADRAO;
  const texto = (c.texto_template || "").trim() || AGENDA_LEMBRETE_TEMPLATE_PADRAO;
  return {
    id: c.id,
    tenant_id: c.tenant_id ?? null,
    agente_slug: c.agente_slug,
    ativo: c.ativo === true,
    minutos_antes: Math.min(1440, Math.max(1, minutos)),
    texto_template: texto,
    timezone: c.timezone?.trim() || TZ_FOLLOWUP_PADRAO,
    criado_em: c.criado_em,
    atualizado_em: c.atualizado_em,
  };
}
