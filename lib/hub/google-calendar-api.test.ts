import { describe, expect, it } from "vitest";
import {
  extrairLinkGoogleMeet,
  montarPayloadEventoGoogleCalendar,
  resumirEventoGoogleCalendar,
  resumirListaEventosGoogleCalendar,
} from "@/lib/hub/google-calendar-api";

describe("google-calendar-api", () => {
  it("monta conferenceData para Google Meet por padrão", () => {
    const { evento, conferenceDataVersion } = montarPayloadEventoGoogleCalendar({
      titulo: "Reunião Cantina",
      inicio: "2026-06-20T10:00:00",
      fim: "2026-06-20T10:30:00",
    });
    expect(conferenceDataVersion).toBe(1);
    expect(evento.conferenceData).toBeTruthy();
    expect(evento.start).toEqual({ dateTime: "2026-06-20T10:00:00", timeZone: "America/Sao_Paulo" });
  });

  it("permite desligar Meet", () => {
    const { evento, conferenceDataVersion } = montarPayloadEventoGoogleCalendar({
      titulo: "Só calendário",
      inicio: "2026-06-20T10:00:00",
      fim: "2026-06-20T11:00:00",
      comGoogleMeet: false,
    });
    expect(conferenceDataVersion).toBeUndefined();
    expect(evento.conferenceData).toBeUndefined();
  });

  it("resume evento com hangoutLink", () => {
    const resumo = resumirEventoGoogleCalendar({
      id: "abc",
      summary: "Demo",
      hangoutLink: "https://meet.google.com/xyz-abcd-efg",
      start: { dateTime: "2026-06-20T10:00:00-03:00" },
      end: { dateTime: "2026-06-20T10:30:00-03:00" },
    });
    expect(resumo?.link_meet).toBe("https://meet.google.com/xyz-abcd-efg");
    expect(resumo?.titulo).toBe("Demo");
  });

  it("extrai meet de conferenceData.entryPoints", () => {
    const link = extrairLinkGoogleMeet({
      entryPoints: [{ entryPointType: "video", uri: "https://meet.google.com/aaa-bbbb-ccc" }],
    });
    expect(link).toContain("meet.google.com");
  });

  it("resume lista de eventos", () => {
    const lista = resumirListaEventosGoogleCalendar({
      items: [{ id: "1", summary: "A", start: { dateTime: "2026-06-21T09:00:00" } }],
    });
    expect(lista.total).toBe(1);
    expect((lista.eventos as { titulo: string }[])[0].titulo).toBe("A");
  });
});
