import { describe, expect, it } from "vitest";
import {
  deveEscalarFallbackHumanoAoLead,
  mensagemFallbackOperacionalAoLead,
  mensagemPedeAtendimentoHumano,
} from "./fallback-ia-policy";

describe("mensagemPedeAtendimentoHumano", () => {
  it("detecta pedido explícito", () => {
    expect(mensagemPedeAtendimentoHumano("quero falar com um atendente humano")).toBe(true);
  });

  it("ignora agenda normal", () => {
    expect(mensagemPedeAtendimentoHumano("cancele a agenda por gentileza")).toBe(false);
  });
});

describe("mensagemFallbackOperacionalAoLead", () => {
  it("não escala playbook para equipe", () => {
    expect(
      mensagemFallbackOperacionalAoLead({
        motivo: "playbook_obrigatorio_sem_resposta",
        mensagemOriginal: "marque uma agenda",
      })
    ).toBeNull();
  });

  it("retry amigável em cancelamento com erro da engine", () => {
    const msg = mensagemFallbackOperacionalAoLead({
      motivo: "engine_sem_resposta",
      mensagemOriginal: "cancele a agenda por gentileza",
    });
    expect(msg).toMatch(/cancelar/i);
    expect(msg).not.toMatch(/encaminhei/i);
  });

  it("escala quando cliente pede humano", () => {
    expect(
      deveEscalarFallbackHumanoAoLead({
        motivo: "engine_sem_resposta",
        mensagemOriginal: "preciso falar com um atendente",
      })
    ).toBe(true);
  });
});
