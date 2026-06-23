import type { SupabaseClient } from "@supabase/supabase-js";

export type GoogleCalendarTenantConfig = {
  duracaoReservaMin: number;
  abertura: string;
  fechamento: string;
  timezone: string;
  comMeetPadrao: boolean;
};

export type HubTenantAgendaConfigRow = {
  tenant_id: string;
  duracao_reserva_min: number;
  abertura: string;
  fechamento: string;
  timezone: string;
  com_meet: boolean;
};

const HORA_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

export function normalizarHoraAgenda(v: unknown, fallback: string): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!HORA_RE.test(s)) return fallback;
  const [h, m] = s.split(":");
  return `${String(Number.parseInt(h, 10)).padStart(2, "0")}:${m}`;
}

/** Fallback global (.env) — usado só se o tenant ainda não tiver linha na tabela. */
export function defaultGoogleCalendarTenantConfig(): GoogleCalendarTenantConfig {
  const durRaw = process.env.GOOGLE_CALENDAR_DURACAO_RESERVA_MIN?.trim();
  const dur = durRaw ? Number.parseInt(durRaw, 10) : 90;
  const meetEnv = (process.env.GOOGLE_CALENDAR_COM_MEET ?? "false").trim().toLowerCase();
  return {
    duracaoReservaMin: Number.isFinite(dur) && dur > 0 ? dur : 90,
    abertura: normalizarHoraAgenda(process.env.GOOGLE_CALENDAR_ABERTURA, "11:30"),
    fechamento: normalizarHoraAgenda(process.env.GOOGLE_CALENDAR_FECHAMENTO, "23:00"),
    timezone: (process.env.GOOGLE_CALENDAR_TIMEZONE || "America/Sao_Paulo").trim() || "America/Sao_Paulo",
    comMeetPadrao: meetEnv === "1" || meetEnv === "true" || meetEnv === "yes",
  };
}

export function parseGoogleCalendarTenantConfig(row: unknown): GoogleCalendarTenantConfig {
  const base = defaultGoogleCalendarTenantConfig();
  if (!row || typeof row !== "object" || Array.isArray(row)) return base;
  const r = row as Record<string, unknown>;
  const dur = typeof r.duracao_reserva_min === "number" ? r.duracao_reserva_min : Number(r.duracao_reserva_min);
  return {
    duracaoReservaMin: Number.isFinite(dur) && dur > 0 && dur <= 480 ? Math.round(dur) : base.duracaoReservaMin,
    abertura: normalizarHoraAgenda(r.abertura, base.abertura),
    fechamento: normalizarHoraAgenda(r.fechamento, base.fechamento),
    timezone:
      typeof r.timezone === "string" && r.timezone.trim() ? r.timezone.trim() : base.timezone,
    comMeetPadrao: r.com_meet === true,
  };
}

export function agendaConfigParaRespostaApi(cfg: GoogleCalendarTenantConfig) {
  return {
    duracao_reserva_min: cfg.duracaoReservaMin,
    abertura: cfg.abertura,
    fechamento: cfg.fechamento,
    timezone: cfg.timezone,
    com_meet: cfg.comMeetPadrao,
  };
}

export function validarPayloadAgendaConfig(body: Record<string, unknown>): {
  ok: true;
  data: GoogleCalendarTenantConfig;
} | { ok: false; error: string } {
  const base = defaultGoogleCalendarTenantConfig();
  const durRaw = body.duracao_reserva_min ?? body.duracaoReservaMin;
  const dur = typeof durRaw === "number" ? durRaw : Number(durRaw);
  if (!Number.isFinite(dur) || dur < 15 || dur > 480) {
    return { ok: false, error: "duracao_reserva_min deve estar entre 15 e 480 minutos." };
  }
  const abertura = normalizarHoraAgenda(body.abertura, "");
  const fechamento = normalizarHoraAgenda(body.fechamento, "");
  if (!HORA_RE.test(abertura) || !HORA_RE.test(fechamento)) {
    return { ok: false, error: "abertura e fechamento devem ser HH:MM (ex. 11:30)." };
  }
  const abMin = horaParaMinutos(abertura);
  const fcMin = horaParaMinutos(fechamento);
  if (fcMin <= abMin) {
    return { ok: false, error: "fechamento deve ser depois de abertura no mesmo dia." };
  }
  const tz = typeof body.timezone === "string" && body.timezone.trim() ? body.timezone.trim() : base.timezone;
  const comMeet = body.com_meet === true || body.comMeetPadrao === true;
  return {
    ok: true,
    data: {
      duracaoReservaMin: Math.round(dur),
      abertura,
      fechamento,
      timezone: tz,
      comMeetPadrao: comMeet,
    },
  };
}

function horaParaMinutos(hora: string): number {
  const [h, m] = hora.split(":").map((x) => Number.parseInt(x, 10));
  return h * 60 + (m || 0);
}

export async function lerTenantAgendaConfig(
  supabase: SupabaseClient,
  tenantId: string
): Promise<GoogleCalendarTenantConfig> {
  const { data, error } = await supabase
    .from("hub_tenant_agenda_config")
    .select("duracao_reserva_min, abertura, fechamento, timezone, com_meet")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error || !data) return defaultGoogleCalendarTenantConfig();
  return parseGoogleCalendarTenantConfig(data);
}

export async function gravarTenantAgendaConfig(
  supabase: SupabaseClient,
  tenantId: string,
  cfg: GoogleCalendarTenantConfig
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = {
    tenant_id: tenantId,
    duracao_reserva_min: cfg.duracaoReservaMin,
    abertura: cfg.abertura,
    fechamento: cfg.fechamento,
    timezone: cfg.timezone,
    com_meet: cfg.comMeetPadrao,
    atualizado_em: new Date().toISOString(),
  };
  const { error } = await supabase.from("hub_tenant_agenda_config").upsert(row, {
    onConflict: "tenant_id",
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
