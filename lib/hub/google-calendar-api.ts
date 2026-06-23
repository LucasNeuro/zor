import { randomUUID } from "crypto";

export function googleCalendarTimeZone(): string {
  return (process.env.GOOGLE_CALENDAR_TIMEZONE || "America/Sao_Paulo").trim() || "America/Sao_Paulo";
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
};

export function montarPayloadEventoGoogleCalendar(input: CriarEventoGoogleCalendarInput): {
  evento: Record<string, unknown>;
  conferenceDataVersion?: number;
} {
  const tz = googleCalendarTimeZone();
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

  const comMeet = input.comGoogleMeet !== false;
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
