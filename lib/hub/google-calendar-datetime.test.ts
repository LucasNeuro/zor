import { describe, expect, it } from "vitest";
import {
  normalizarInicioParaGoogleCalendar,
  parseHoraCliente,
} from "@/lib/hub/google-calendar-datetime";
import type { GoogleCalendarTenantConfig } from "@/lib/hub/tenant-agenda-config";

const cfg: GoogleCalendarTenantConfig = {
  duracaoReservaMin: 90,
  abertura: "11:30",
  fechamento: "23:00",
  timezone: "America/Sao_Paulo",
  comMeetPadrao: false,
};

describe("google-calendar-datetime", () => {
  it("parseia 20h30", () => {
    expect(parseHoraCliente("20:30")).toEqual({ h: 20, m: 30 });
    expect(parseHoraCliente("20h30")).toEqual({ h: 20, m: 30 });
  });

  it("corrige 08:30 para 20:30 quando antes da abertura", () => {
    const r = normalizarInicioParaGoogleCalendar("2026-06-23T08:30:00", cfg);
    expect(r.inicio).toBe("2026-06-23T20:30:00");
    expect(r.corrigido).toBe(true);
  });

  it("usa hora_cliente explícita", () => {
    const r = normalizarInicioParaGoogleCalendar("2026-06-23T08:30:00", cfg, {
      horaCliente: "20:30",
    });
    expect(r.inicio).toBe("2026-06-23T20:30:00");
  });

  it("mantém 12:30 almoço", () => {
    const r = normalizarInicioParaGoogleCalendar("2026-06-23T12:30:00", cfg);
    expect(r.inicio).toBe("2026-06-23T12:30:00");
    expect(r.corrigido).toBe(false);
  });
});
