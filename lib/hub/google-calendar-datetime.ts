import type { GoogleCalendarTenantConfig } from "@/lib/hub/tenant-agenda-config";

/** Interpreta «20:30», «20h30», «8:30 PM», «20.30». */
export function parseHoraCliente(texto: string): { h: number; m: number } | null {
  const raw = texto.trim().toLowerCase();
  if (!raw) return null;

  const match = raw.match(/(\d{1,2})\s*[:h.]\s*(\d{2})/);
  if (!match) return null;

  let h = Number.parseInt(match[1], 10);
  const m = Number.parseInt(match[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(m) || m < 0 || m > 59) return null;

  const temPm = /\b(pm|p\.m\.|da noite|à noite|a noite|noite)\b/.test(raw);
  const temAm = /\b(am|a\.m\.|da manhã|de manhã|manhã)\b/.test(raw);

  if (temPm && h < 12) h += 12;
  if (temAm && h === 12) h = 0;
  if (h < 0 || h > 23) return null;

  return { h, m };
}

function horaParaMinutos(hora: string): number {
  const [h, m] = hora.split(":").map((x) => Number.parseInt(x, 10));
  return h * 60 + (m || 0);
}

function hojeIsoNoFuso(tz: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Normaliza início para Google Calendar (horário de parede no fuso do tenant).
 * Corrige erro comum: 20h30 gravado como 08:30.
 */
export function normalizarInicioParaGoogleCalendar(
  raw: string,
  cfg: GoogleCalendarTenantConfig,
  opts?: { horaCliente?: string }
): { inicio: string; corrigido: boolean; aviso?: string } {
  let s = raw.trim();
  if (!s) return { inicio: s, corrigido: false };

  s = s.replace(/Z$/i, "").replace(/([+-]\d{2}:\d{2})$/, "");

  const horaCli = opts?.horaCliente ? parseHoraCliente(opts.horaCliente) : null;
  const dateMatch = s.match(/^(\d{4}-\d{2}-\d{2})/);
  const datePart = dateMatch?.[1] ?? hojeIsoNoFuso(cfg.timezone);

  if (horaCli) {
    s = `${datePart}T${String(horaCli.h).padStart(2, "0")}:${String(horaCli.m).padStart(2, "0")}:00`;
  }

  const dtMatch = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!dtMatch) {
    return { inicio: s, corrigido: false };
  }

  const [, date, hStr, mStr] = dtMatch;
  let h = Number.parseInt(hStr, 10);
  const m = Number.parseInt(mStr, 10);
  const aberturaMin = horaParaMinutos(cfg.abertura);
  const horaMin = h * 60 + m;
  let corrigido = false;

  if (h >= 7 && h <= 11 && horaMin < aberturaMin) {
    h += 12;
    corrigido = true;
  }

  if (horaCli && horaCli.h >= 12 && h < 12 && h === horaCli.h - 12) {
    h = horaCli.h;
    corrigido = true;
  }

  const inicio = `${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
  return {
    inicio,
    corrigido,
    aviso: corrigido
      ? `Horário ajustado para ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} (24h, ${cfg.timezone}).`
      : undefined,
  };
}

export function normalizarFimParaGoogleCalendar(
  inicio: string,
  fimRaw: string | undefined,
  cfg: GoogleCalendarTenantConfig
): string {
  const fimTrim = (fimRaw ?? "").trim();
  if (fimTrim && fimTrim !== inicio) {
    const n = normalizarInicioParaGoogleCalendar(fimTrim, cfg);
    return n.inicio;
  }
  const [date, time] = inicio.split("T");
  if (!date || !time) return inicio;
  const [h, m] = time.split(":").map((x) => Number.parseInt(x, 10));
  const total = h * 60 + m + cfg.duracaoReservaMin;
  const h2 = Math.floor(total / 60) % 24;
  const m2 = total % 60;
  return `${date}T${String(h2).padStart(2, "0")}:${String(m2).padStart(2, "0")}:00`;
}

export const GCAL_LEAD_PROP = "waje_lead_id";
export const GCAL_TEL_PROP = "waje_telefone";

export function montarExtendedPropertiesLead(leadId: string, telefone?: string | null) {
  const priv: Record<string, string> = { [GCAL_LEAD_PROP]: leadId };
  const tel = telefone?.replace(/\D/g, "");
  if (tel) priv[GCAL_TEL_PROP] = tel;
  return { private: priv };
}
