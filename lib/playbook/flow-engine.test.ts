import { describe, expect, it, vi } from "vitest";
import {
  executeFlowEngine,
  normMenuChoiceText,
  resolveMenuChoiceId,
  type FlowEngineDefinition,
} from "./flow-engine";

const MENU_CHOICES = [
  { id: "m2_50_100", label: "De 50 a 100 m2" },
  { id: "m2_100_200", label: "De 100 a 200 m2" },
  { id: "m2_acima_200", label: "Acima de 200 m2" },
];

describe("resolveMenuChoiceId", () => {
  it("mapeia resposta numérica 1..n para o id da opção", () => {
    expect(resolveMenuChoiceId("1", null, MENU_CHOICES)).toBe("m2_50_100");
    expect(resolveMenuChoiceId("2", null, MENU_CHOICES)).toBe("m2_100_200");
    expect(resolveMenuChoiceId("3", null, MENU_CHOICES)).toBe("m2_acima_200");
  });

  it("aceita texto livre igual ou parecido com o rótulo", () => {
    expect(resolveMenuChoiceId("De 50 a 100 m2", null, MENU_CHOICES)).toBe("m2_50_100");
    expect(resolveMenuChoiceId("De 50 a 100 m²", null, MENU_CHOICES)).toBe("m2_50_100");
    expect(resolveMenuChoiceId("de 50 a 100 m2", null, MENU_CHOICES)).toBe("m2_50_100");
  });

  it("aceita id direto e formato label|id", () => {
    expect(resolveMenuChoiceId("m2_100_200", null, MENU_CHOICES)).toBe("m2_100_200");
    expect(resolveMenuChoiceId("De 100 a 200 m2|m2_100_200", null, MENU_CHOICES)).toBe(
      "m2_100_200"
    );
  });

  it("usa aliases globais quando o id pertence ao menu atual", () => {
    const global = (msg: string) => (msg === "Até 50" ? "arq_m2_ate50" : null);
    const choices = [
      { id: "arq_m2_ate50", label: "Até 50 m²" },
      { id: "arq_m2_51_250", label: "51-250 m²" },
    ];
    expect(resolveMenuChoiceId("Até 50", null, choices, global)).toBe("arq_m2_ate50");
  });
});

describe("normMenuChoiceText", () => {
  it("normaliza m² e pontuação", () => {
    expect(normMenuChoiceText("De 50 a 100 m²")).toBe("de 50 a 100 m2");
  });
});

describe("executeFlowEngine menu", () => {
  const definition: FlowEngineDefinition = {
    start_step: "arq_tamanho",
    steps: {
      arq_tamanho: {
        id: "arq_tamanho",
        type: "menu",
        text: "Qual o tamanho?",
        answer_key: "arq_tamanho",
        choices: MENU_CHOICES.map((c) => ({ ...c, next_step: "arq_prazo" })),
      },
      arq_prazo: {
        id: "arq_prazo",
        type: "ask_text",
        prompt: "Cidade?",
        answer_key: "cidade",
        next_step: "concluido",
      },
      concluido: { id: "concluido", type: "complete" },
    },
  };

  it("avança com resposta numérica e grava answer_key", async () => {
    const persistState = vi.fn().mockResolvedValue(undefined);
    const sendMenu = vi.fn().mockResolvedValue({ ok: true });

    const result = await executeFlowEngine(
      definition,
      {
        step: "arq_tamanho",
        answers: {},
        mensagem: "2",
        tipoMidia: "texto",
      },
      {
        sendText: vi.fn().mockResolvedValue(undefined),
        sendMenu,
        resolveChoiceId: () => null,
        persistState,
      }
    );

    expect(result).toEqual({ handled: true, skipIa: true, step: "arq_prazo" });
    expect(sendMenu).not.toHaveBeenCalled();
    const persistedToPrazo = persistState.mock.calls.find(
      (call) => call[0]?.step === "arq_prazo" && call[0]?.answers?.arq_tamanho === "m2_100_200"
    );
    expect(persistedToPrazo).toBeTruthy();
  });
});
