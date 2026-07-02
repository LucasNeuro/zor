import { describe, expect, it } from "vitest";
import { inferirHarnessModoDaMensagem } from "@/lib/harness/infer-mode";

describe("inferirHarnessModoDaMensagem", () => {
  it("operar em pedidos de gravação", () => {
    expect(inferirHarnessModoDaMensagem("Cria um lead para João")).toBe("operar");
    expect(inferirHarnessModoDaMensagem("Atualiza o estágio do lead 42")).toBe("operar");
  });

  it("planear em pedidos de plano", () => {
    expect(inferirHarnessModoDaMensagem("Monta um plano passo a passo para onboarding")).toBe("planear");
  });

  it("analisar em consultas CRM", () => {
    expect(inferirHarnessModoDaMensagem("Lista os leads novos")).toBe("analisar");
    expect(inferirHarnessModoDaMensagem("Quantos negócios abertos temos?")).toBe("analisar");
  });

  it("conversar em explicações", () => {
    expect(inferirHarnessModoDaMensagem("O que é um lead no CRM?")).toBe("conversar");
  });

  it("escrita tem prioridade sobre consulta na mesma frase", () => {
    expect(inferirHarnessModoDaMensagem("Lista leads e cria um novo para Maria")).toBe("operar");
  });
});
