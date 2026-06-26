import { describe, expect, it } from "vitest";
import {
  avaliarJanelaDisparoFollowup,
  followupPermitidoNaJanela,
  horariosDisparoFollowup,
} from "@/lib/hub/followup-janela";

describe("followup janela horária", () => {
  it("ativa só dentro da tolerância do slot", () => {
    const dentro = avaliarJanelaDisparoFollowup(["10:00"], {
      toleranciaMinutos: 20,
      agora: new Date("2026-06-25T13:10:00.000Z"), // 10:10 BRT
    });
    expect(dentro.ativa).toBe(true);
    expect(dentro.slot).toBe("10:00");

    const fora = avaliarJanelaDisparoFollowup(["10:00"], {
      toleranciaMinutos: 20,
      agora: new Date("2026-06-25T13:45:00.000Z"), // 10:45 BRT
    });
    expect(fora.ativa).toBe(false);
    expect(fora.proximo).toBe("10:00");
  });

  it("modo continuo ignora janela", () => {
    const r = followupPermitidoNaJanela({
      execucao_modo: "continuo",
      horarios_disparo: ["10:00"],
    });
    expect(r.ativa).toBe(true);
  });

  it("usa horários padrão quando config vazia", () => {
    expect(horariosDisparoFollowup({})).toEqual(["09:00", "14:00", "18:00"]);
  });
});
