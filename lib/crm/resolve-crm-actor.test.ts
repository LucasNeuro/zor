import { describe, expect, it } from "vitest";
import { humanoBloqueiaRespostaIa } from "@/lib/crm/resolve-crm-actor";

describe("humanoBloqueiaRespostaIa", () => {
  it("não bloqueia sem humano efetivo", () => {
    expect(humanoBloqueiaRespostaIa({ humano_responsavel: null })).toBe(false);
    expect(humanoBloqueiaRespostaIa({ humano_responsavel: "wendel" })).toBe(false);
  });

  it("não bloqueia quando fase é conversa_ia (webhook WA)", () => {
    expect(
      humanoBloqueiaRespostaIa({
        humano_responsavel: "celular",
        metadata: { fase_atendimento: "conversa_ia" },
      })
    ).toBe(false);
  });

  it("bloqueia em atendimento humano explícito", () => {
    expect(
      humanoBloqueiaRespostaIa({
        humano_responsavel: "Lucas",
        metadata: { fase_atendimento: "atendimento_humano" },
      })
    ).toBe(true);
  });
});
