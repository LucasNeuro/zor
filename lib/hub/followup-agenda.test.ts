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

  it("formatarProximoFollowup devolve string legível", () => {
    const fmt = formatarProximoFollowup("2026-06-25T15:30:00.000Z");
    expect(fmt).toBeTruthy();
  });
});
