import { describe, expect, it } from "vitest";
import {
  calcularProximoFollowupEm,
  followupAgendadoParaAgora,
  formatarProximoFollowup,
} from "@/lib/hub/followup-agenda";

describe("followup agenda", () => {
  it("followupAgendadoParaAgora quando nulo ou passado", () => {
    const agora = new Date("2026-06-25T15:00:00.000Z");
    expect(followupAgendadoParaAgora(null, agora)).toBe(true);
    expect(followupAgendadoParaAgora("2026-06-25T14:00:00.000Z", agora)).toBe(true);
    expect(followupAgendadoParaAgora("2026-06-25T16:00:00.000Z", agora)).toBe(false);
  });

  it("calcularProximoFollowupEm modo continuo soma minutos", () => {
    const agora = new Date("2026-06-25T15:00:00.000Z");
    const iso = calcularProximoFollowupEm(agora, 5, { janela_modo: "continuo" });
    expect(new Date(iso).getTime()).toBe(agora.getTime() + 5 * 60_000);
  });

  it("modo slots legado usa faixa contínua — cadência não espera próximo slot", () => {
    const agora = new Date("2026-06-26T17:01:00.000Z"); // 14:01 BRT
    const iso = calcularProximoFollowupEm(agora, 4, {
      janela_modo: "slots",
      horarios_disparo: ["09:00", "14:00", "18:00"],
      horario_inicio: "08:00",
      horario_fim: "22:00",
      timezone: "America/Sao_Paulo",
    });
    const alvo = new Date(iso);
    expect(alvo.getTime() - agora.getTime()).toBeLessThanOrEqual(5 * 60_000);
    expect(alvo.getTime()).toBeLessThan(new Date("2026-06-26T21:00:00.000Z").getTime());
  });

  it("formatarProximoFollowup devolve string legível", () => {
    const fmt = formatarProximoFollowup("2026-06-25T15:30:00.000Z");
    expect(fmt).toBeTruthy();
  });
});
