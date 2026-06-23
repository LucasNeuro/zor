import { randomUUID } from "crypto";
import {
  defaultGoogleCalendarTenantConfig,
  type GoogleCalendarTenantConfig,
} from "@/lib/hub/tenant-agenda-config";

export type { GoogleCalendarTenantConfig };

export function googleCalendarTimeZone(cfg = defaultGoogleCalendarTenantConfig()): string {
  return cfg.timezone;
}

export function googleCalendarDuracaoReservaMinutos(cfg = defaultGoogleCalendarTenantConfig()): number {
  return cfg.duracaoReservaMin;
}

export function googleCalendarComMeetPadrao(cfg = defaultGoogleCalendarTenantConfig()): boolean {
  return cfg.comMeetPadrao;
}

export function googleCalendarHorarioFuncionamento(cfg = defaultGoogleCalendarTenantConfig()): {
  abertura: string;
  fechamento: string;
} {
  return { abertura: cfg.abertura, fechamento: cfg.fechamento };
}

export function extrairLinkGoogleMeet(conferenceData: unknown): string | null {
  if (!conferenceData || typeof conferenceData !== "object" || Array.isArray(conferenceData)) return null;
  const o = conferenceData as Record<string, unknown>;
  const entryPoints = o.entryPoints;
  if (!Array.isArray(entryPoints)) return null;
  for (const ep of entryPoints) {
    if (!ep || typeof ep !== "object") continue;
    const row = ep as Record<string, unknown>;
    const uri = typeof row.uri === "string" ? row.uri.trim() : "";
    if (uri.includes("meet.google.com")) return uri;
  }
  return null;
}

export function resumirEventoGoogleCalendar(ev: unknown): Record<string, unknown> | null {
  if (!ev || typeof ev !== "object" || Array.isArray(ev)) return null;
  const e = ev as Record<string, unknown>;
  const start = e.start && typeof e.start === "object" ? (e.start as Record<string, unknown>) : {};
  const end = e.end && typeof e.end === "object" ? (e.end as Record<string, unknown>) : {};
  const hangout =
    typeof e.hangoutLink === "string" && e.hangoutLink.trim()
      ? e.hangoutLink.trim()
      : extrairLinkGoogleMeet(e.conferenceData);

  return {
    id: e.id ?? null,
    titulo: e.summary ?? null,
    inicio: start.dateTime ?? start.date ?? null,
    fim: end.dateTime ?? end.date ?? null,
    link_meet: hangout,
    link_calendario: typeof e.htmlLink === "string" ? e.htmlLink : null,
    status: e.status ?? null,
  };
}

export function resumirListaEventosGoogleCalendar(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { eventos: [] };
  }
  const items = (body as Record<string, unknown>).items;
  if (!Array.isArray(items)) return { eventos: [] };
  const eventos = items
    .map((ev) => resumirEventoGoogleCalendar(ev))
    .filter((x): x is Record<string, unknown> => x != null);
  return { eventos, total: eventos.length };
}

export type CriarEventoGoogleCalendarInput = {
  titulo: string;
  inicio: string;
  fim: string;
  descricao?: string;
  participantes?: string[];
  comGoogleMeet?: boolean;
  extendedProperties?: { private?: Record<string, string> };
};

export function inferirFimEventoGoogleCalendar(
  inicio: string,
  fim?: string,
  cfg = defaultGoogleCalendarTenantConfig()
): string {
  const inicioTrim = inicio.trim();
  const fimTrim = (fim ?? "").trim();
  if (fimTrim && fimTrim !== inicioTrim) return fimTrim;

  const parsed = new Date(inicioTrim);
  if (!Number.isNaN(parsed.getTime())) {
    const duracaoMs = cfg.duracaoReservaMin * 60 * 1000;
    const fimCalc = new Date(parsed.getTime() + duracaoMs);
    const tz = cfg.timezone;
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .format(fimCalc)
      .replace(" ", "T");
  }

  return fimTrim || inicioTrim;
}

export function montarPayloadEventoGoogleCalendar(
  input: CriarEventoGoogleCalendarInput,
  cfg = defaultGoogleCalendarTenantConfig()
): {
  evento: Record<string, unknown>;
  conferenceDataVersion?: number;
} {
  const tz = cfg.timezone;
  const evento: Record<string, unknown> = {
    summary: input.titulo,
    description: input.descricao || undefined,
    start: { dateTime: input.inicio, timeZone: tz },
    end: { dateTime: input.fim, timeZone: tz },
  };

  const participantes = input.participantes?.filter(Boolean) ?? [];
  if (participantes.length > 0) {
    evento.attendees = participantes.map((email) => ({ email }));
  }

  if (input.extendedProperties?.private && Object.keys(input.extendedProperties.private).length > 0) {
    evento.extendedProperties = input.extendedProperties;
  }

  const comMeet = input.comGoogleMeet ?? cfg.comMeetPadrao;
  if (comMeet) {
    evento.conferenceData = {
      createRequest: {
        requestId: randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  return comMeet ? { evento, conferenceDataVersion: 1 } : { evento };
}

type IntervaloOcupado = { inicio: string; fim: string };

function parseIsoLocal(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatarHoraLabel(iso: string, tz: string): string {
  const d = parseIsoLocal(iso);
  if (!d) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function diaChaveFromIso(iso: string, tz: string): string {
  const d = parseIsoLocal(iso);
  if (!d) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function montarIsoLocal(dia: string, hora: string, tz: string): string {
  const [h, m] = hora.split(":").map((x) => Number.parseInt(x, 10));
  const hh = String(h).padStart(2, "0");
  const mm = String(m ?? 0).padStart(2, "0");
  const base = `${dia}T${hh}:${mm}:00`;
  const probe = new Date(`${base}Z`);
  if (Number.isNaN(probe.getTime())) return base;
  return base;
}

function intervalosSobrepoem(aInicio: Date, aFim: Date, bInicio: Date, bFim: Date): boolean {
  return aInicio < bFim && bInicio < aFim;
}

function extrairIntervalosOcupados(body: unknown, cfg: GoogleCalendarTenantConfig): IntervaloOcupado[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) return [];
  const items = (body as Record<string, unknown>).items;
  if (!Array.isArray(items)) return [];
  const out: IntervaloOcupado[] = [];
  for (const ev of items) {
    if (!ev || typeof ev !== "object") continue;
    const e = ev as Record<string, unknown>;
    const start = e.start && typeof e.start === "object" ? (e.start as Record<string, unknown>) : {};
    const end = e.end && typeof e.end === "object" ? (e.end as Record<string, unknown>) : {};
    const inicio = String(start.dateTime ?? start.date ?? "").trim();
    let fim = String(end.dateTime ?? end.date ?? "").trim();
    if (!inicio) continue;
    if (!fim) {
      const d = parseIsoLocal(inicio);
      if (d) {
        fim = new Date(d.getTime() + cfg.duracaoReservaMin * 60 * 1000).toISOString();
      } else {
        fim = inicio;
      }
    }
    out.push({ inicio, fim });
  }
  return out;
}

function gerarVagasDia(
  dia: string,
  ocupados: IntervaloOcupado[],
  tz: string,
  duracaoMin: number,
  abertura: string,
  fechamento: string
): Array<{ inicio: string; fim: string; label: string }> {
  const [abH, abM] = abertura.split(":").map((x) => Number.parseInt(x, 10));
  const [fcH, fcM] = fechamento.split(":").map((x) => Number.parseInt(x, 10));
  const inicioMin = abH * 60 + (abM || 0);
  const fimMin = fcH * 60 + (fcM || 0);
  const vagas: Array<{ inicio: string; fim: string; label: string }> = [];

  const ocupadosDia = ocupados
    .filter((o) => diaChaveFromIso(o.inicio, tz) === dia)
    .map((o) => ({
      inicio: parseIsoLocal(o.inicio),
      fim: parseIsoLocal(o.fim),
    }))
    .filter((x): x is { inicio: Date; fim: Date } => x.inicio != null && x.fim != null);

  for (let cursor = inicioMin; cursor + duracaoMin <= fimMin; cursor += duracaoMin) {
    const h = Math.floor(cursor / 60);
    const m = cursor % 60;
    const horaStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const inicioIso = montarIsoLocal(dia, horaStr, tz);
    const inicioDate = parseIsoLocal(inicioIso);
    if (!inicioDate) continue;
    const fimDate = new Date(inicioDate.getTime() + duracaoMin * 60 * 1000);
    const conflito = ocupadosDia.some((o) => intervalosSobrepoem(inicioDate, fimDate, o.inicio, o.fim));
    if (conflito) continue;
    if (inicioDate.getTime() < Date.now()) continue;
    vagas.push({
      inicio: inicioIso,
      fim: fimDate.toISOString().slice(0, 19),
      label: formatarHoraLabel(inicioIso, tz),
    });
  }
  return vagas;
}

/** Resposta segura para o cliente: só slots livres/ocupados, sem nomes de terceiros. */
export function resumirListaEventosParaDisponibilidade(
  body: unknown,
  opts?: { dias?: number; dataFoco?: string; cfg?: GoogleCalendarTenantConfig }
): Record<string, unknown> {
  const cfg = opts?.cfg ?? defaultGoogleCalendarTenantConfig();
  const tz = cfg.timezone;
  const duracaoMin = cfg.duracaoReservaMin;
  const { abertura, fechamento } = { abertura: cfg.abertura, fechamento: cfg.fechamento };
  const dias = opts?.dias && opts.dias > 0 ? opts.dias : 7;
  const dataFoco = opts?.dataFoco?.trim();

  const ocupados = extrairIntervalosOcupados(body, cfg);
  const horariosOcupados = ocupados.map((o) => ({
    inicio: o.inicio,
    fim: o.fim,
    label_inicio: formatarHoraLabel(o.inicio, tz),
    label_fim: formatarHoraLabel(o.fim, tz),
  }));

  const vagasPorDia: Record<string, Array<{ inicio: string; fim: string; label: string }>> = {};
  const hoje = new Date();
  const diasParaCalcular = dataFoco ? [dataFoco] : Array.from({ length: dias }, (_, i) => {
    const d = new Date(hoje.getTime() + i * 86400000);
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  });

  for (const dia of diasParaCalcular) {
    vagasPorDia[dia] = gerarVagasDia(dia, ocupados, tz, duracaoMin, abertura, fechamento);
  }

  const vagasHoje = vagasPorDia[diasParaCalcular[0]] ?? [];

  return {
    privacidade:
      "Dados de outros clientes não são expostos. Use apenas vagas_disponiveis e horarios_ocupados (sem nomes).",
    duracao_reserva_minutos: duracaoMin,
    horario_funcionamento: { abertura, fechamento, timezone: tz },
    horarios_ocupados: horariosOcupados,
    vagas_disponiveis_hoje: vagasHoje,
    vagas_por_dia: vagasPorDia,
    instrucao_agente:
      "Ao responder no WhatsApp, cite só horários de vagas_disponiveis (ex.: 19h, 20h30). Nunca cite títulos ou nomes de eventos ocupados.",
  };
}

/** Link que o agente deve colar na mensagem WhatsApp após criar evento. */
export function linkEventoParaWhatsapp(resumo: Record<string, unknown> | null): string | null {
  if (!resumo) return null;
  const meet = typeof resumo.link_meet === "string" ? resumo.link_meet.trim() : "";
  const cal = typeof resumo.link_calendario === "string" ? resumo.link_calendario.trim() : "";
  return meet || cal || null;
}
