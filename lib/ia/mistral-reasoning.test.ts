import { describe, expect, it, afterEach } from "vitest";
import {
  extrairTextoRespostaMistral,
  mistralReasoningEffortFromEnv,
  resolveMistralReasoningEffort,
} from "@/lib/ia/mistral-reasoning";

describe("extrairTextoRespostaMistral", () => {
  it("retorna string simples", () => {
    expect(extrairTextoRespostaMistral("Olá!")).toBe("Olá!");
  });

  it("extrai apenas chunks text e ignora thinking", () => {
    const content = [
      { type: "thinking", thinking: [{ type: "text", text: "raciocínio interno" }] },
      { type: "text", text: "Resposta final." },
    ];
    expect(extrairTextoRespostaMistral(content)).toBe("Resposta final.");
  });

  it("concatena múltiplos chunks text", () => {
    const content = [
      { type: "text", text: "Parte A " },
      { type: "text", text: "Parte B" },
    ];
    expect(extrairTextoRespostaMistral(content)).toBe("Parte A Parte B");
  });
});

describe("resolveMistralReasoningEffort", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it("default none", () => {
    delete process.env.MISTRAL_REASONING_EFFORT;
    expect(mistralReasoningEffortFromEnv()).toBe("none");
  });

  it("global high", () => {
    process.env.MISTRAL_REASONING_EFFORT = "high";
    expect(resolveMistralReasoningEffort()).toBe("high");
  });

  it("playbook_ia only — none fora de playbook", () => {
    process.env.MISTRAL_REASONING_EFFORT = "high";
    process.env.MISTRAL_REASONING_EFFORT_PLAYBOOK_IA_ONLY = "1";
    expect(resolveMistralReasoningEffort({ playbookIaTurn: false })).toBe("none");
    expect(resolveMistralReasoningEffort({ playbookIaTurn: true })).toBe("high");
  });
});
