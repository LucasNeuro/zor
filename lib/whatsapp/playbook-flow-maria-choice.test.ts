import { describe, expect, it } from "vitest";
import { resolverChoiceId } from "./playbook-flow-maria";

describe("resolverChoiceId", () => {
  it("resolve aliases legados e formato label|id", () => {
    expect(resolverChoiceId("Comprar, vender ou alugar imóvel", null)).toBe("triagem_imob");
    expect(resolverChoiceId("De 50 a 100 m²|arq_tamanho_50_100", null)).toBeNull();
    expect(resolverChoiceId("fluxo1", null)).toBe("fluxo1");
  });
});
