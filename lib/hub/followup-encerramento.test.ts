import { describe, expect, it } from "vitest";
import {
  heuristicaClassificacaoCliente,
  heuristicaEncerramentoRespostaAgente,
  leadTemReservaCalendarioFutura,
} from "@/lib/hub/followup-encerramento";

describe("followup-encerramento heurísticas", () => {
  it("obrigado após despedida do agente → encerramento", () => {
    expect(
      heuristicaClassificacaoCliente("Obrigado", "Até logo! Qualquer dúvida antes da demonstração.")
    ).toBe("encerramento");
  });

  it("pergunta nova → continuar", () => {
    expect(
      heuristicaClassificacaoCliente("Quanto custa o plano anual?", "Até logo!")
    ).toBe("continuar");
  });

  it("resposta agente com calendar + até já → encerramento", () => {
    expect(
      heuristicaEncerramentoRespostaAgente(
        "Segue o link: https://calendar.google.com/calendar/event?eid=abc Até já! 😊"
      )
    ).toBe(true);
  });

  it("tool gcal criar evento → encerramento", () => {
    expect(
      heuristicaEncerramentoRespostaAgente("Confirmado.", [
        { nome: "hub_int_gcal_criar_evento", ok: true },
      ])
    ).toBe(true);
  });

  it("lead com reserva futura", () => {
    const futuro = new Date(Date.now() + 86400000).toISOString();
    expect(
      leadTemReservaCalendarioFutura({
        google_calendar_reservas: [{ event_id: "1", inicio: futuro, fim: null, link_calendario: null, link_meet: null, criado_em: "" }],
      })
    ).toBe(true);
  });
});
