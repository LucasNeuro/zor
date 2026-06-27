import { describe, expect, it } from "vitest";
import {
  interpolarTemplateAgendaLembrete,
  reservaNaJanelaLembrete,
  reservasAgendaDoLead,
} from "@/lib/hub/agenda-lembrete-types";

describe("reservaNaJanelaLembrete", () => {
  const inicio = "2026-06-28T14:00:00-03:00";

  it("dispara quando faltam 10 minutos", () => {
    const agora = new Date("2026-06-28T13:50:00-03:00").getTime();
    expect(reservaNaJanelaLembrete(inicio, agora, 10)).toBe(true);
  });

  it("dispara quando faltam 5 minutos (dentro da janela de 10)", () => {
    const agora = new Date("2026-06-28T13:55:00-03:00").getTime();
    expect(reservaNaJanelaLembrete(inicio, agora, 10)).toBe(true);
  });

  it("não dispara quando faltam 15 minutos", () => {
    const agora = new Date("2026-06-28T13:45:00-03:00").getTime();
    expect(reservaNaJanelaLembrete(inicio, agora, 10)).toBe(false);
  });

  it("não dispara após o início", () => {
    const agora = new Date("2026-06-28T14:01:00-03:00").getTime();
    expect(reservaNaJanelaLembrete(inicio, agora, 10)).toBe(false);
  });
});

describe("reservasAgendaDoLead", () => {
  it("extrai reservas do metadata", () => {
    const reservas = reservasAgendaDoLead({
      google_calendar_reservas: [
        {
          event_id: "abc",
          inicio: "2026-06-28T14:00:00",
          fim: null,
          link_meet: "https://meet.google.com/x",
          link_calendario: null,
          criado_em: "",
        },
      ],
    });
    expect(reservas).toHaveLength(1);
    expect(reservas[0]?.event_id).toBe("abc");
  });
});

describe("interpolarTemplateAgendaLembrete", () => {
  it("substitui placeholders de agenda", () => {
    const out = interpolarTemplateAgendaLembrete(
      "Oi {nome}, às {hora} ({data}) — {link_meet}",
      {
        nome: "Lucas Silva",
        hora: "14:00",
        data: "28/06/2026",
        link_meet: "https://meet.google.com/abc",
        link: "https://meet.google.com/abc",
      }
    );
    expect(out).toContain("Lucas");
    expect(out).toContain("14:00");
    expect(out).toContain("meet.google.com");
  });
});
