import { describe, expect, it } from "vitest";
import {
  defaultGoogleCalendarTenantConfig,
  parseGoogleCalendarTenantConfig,
  validarPayloadAgendaConfig,
} from "@/lib/hub/tenant-agenda-config";

describe("tenant-agenda-config", () => {
  it("parseia linha do banco", () => {
    const cfg = parseGoogleCalendarTenantConfig({
      duracao_reserva_min: 120,
      abertura: "12:00",
      fechamento: "22:00",
      timezone: "America/Sao_Paulo",
      com_meet: true,
    });
    expect(cfg.duracaoReservaMin).toBe(120);
    expect(cfg.abertura).toBe("12:00");
    expect(cfg.comMeetPadrao).toBe(true);
  });

  it("valida payload PATCH", () => {
    const ok = validarPayloadAgendaConfig({
      duracao_reserva_min: 90,
      abertura: "11:30",
      fechamento: "23:00",
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.data.duracaoReservaMin).toBe(90);
  });

  it("rejeita fechamento antes da abertura", () => {
    const bad = validarPayloadAgendaConfig({
      duracao_reserva_min: 60,
      abertura: "20:00",
      fechamento: "10:00",
    });
    expect(bad.ok).toBe(false);
  });

  it("defaults from env helper", () => {
    const d = defaultGoogleCalendarTenantConfig();
    expect(d.duracaoReservaMin).toBeGreaterThan(0);
    expect(d.abertura).toMatch(/^\d{2}:\d{2}$/);
  });
});
