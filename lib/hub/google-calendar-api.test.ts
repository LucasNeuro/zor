import { describe, expect, it } from "vitest";
import {
  extrairLinkGoogleMeet,
  montarPayloadEventoGoogleCalendar,
  resumirEventoGoogleCalendar,
  resumirListaEventosGoogleCalendar,
  resumirListaEventosParaDisponibilidade,
  linkEventoParaWhatsapp,
} from "@/lib/hub/google-calendar-api";

describe("google-calendar-api", () => {
  it("monta conferenceData para Google Meet quando comGoogleMeet true", () => {
    const { evento, conferenceDataVersion } = montarPayloadEventoGoogleCalendar({
      titulo: "Reunião Cantina",
      inicio: "2026-06-20T10:00:00",
      fim: "2026-06-20T10:30:00",
      comGoogleMeet: true,
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

  it("resume lista de eventos (admin)", () => {
    const lista = resumirListaEventosGoogleCalendar({
      items: [{ id: "1", summary: "A", start: { dateTime: "2026-06-21T09:00:00" } }],
    });
    expect(lista.total).toBe(1);
    expect((lista.eventos as { titulo: string }[])[0].titulo).toBe("A");
  });

  it("disponibilidade não expõe nomes de eventos", () => {
    const disp = resumirListaEventosParaDisponibilidade(
      {
        items: [
          {
            summary: "Reserva Lucas - 4 pessoas",
            start: { dateTime: "2026-06-23T20:30:00-03:00" },
            end: { dateTime: "2026-06-23T22:00:00-03:00" },
          },
        ],
      },
      { dataFoco: "2026-06-23", dias: 1 }
    );
    const json = JSON.stringify(disp);
    expect(json).not.toContain("Lucas");
    expect(disp.horarios_ocupados).toBeTruthy();
    expect(disp.privacidade).toBeTruthy();
  });

  it("linkEventoParaWhatsapp prioriza Meet", () => {
    const link = linkEventoParaWhatsapp({
      link_meet: "https://meet.google.com/abc",
      link_calendario: "https://calendar.google.com/event?eid=x",
    });
    expect(link).toContain("meet.google.com");
  });
});
