import { describe, expect, it } from "vitest";
import {
  nomeCandidatoEhValido,
  nomeLeadEhPlaceholder,
  pushNameParaNomeExibicao,
  resolverNomeExibicaoLead,
} from "@/lib/crm/lead-nome-validacao";

describe("lead-nome-validacao", () => {
  it("trata frases de conversa como placeholder", () => {
    expect(nomeLeadEhPlaceholder("Oi está aí")).toBe(true);
    expect(nomeLeadEhPlaceholder("Lead 1234")).toBe(true);
    expect(nomeLeadEhPlaceholder("Lucas")).toBe(false);
  });

  it("normaliza pushName do WhatsApp", () => {
    expect(pushNameParaNomeExibicao("lucas")).toBe("Lucas");
    expect(pushNameParaNomeExibicao("Oi está aí")).toBeUndefined();
  });

  it("valida candidatos a nome", () => {
    expect(nomeCandidatoEhValido("Lucas De Deus Marcondes")).toBe(true);
    expect(nomeCandidatoEhValido("desmarque a minha agenda")).toBe(false);
  });

  it("resolve nome de exibição com fallback", () => {
    expect(
      resolverNomeExibicaoLead({
        nomeAtual: "Oi está aí",
        pushName: "lucas",
        telefone: "5511970364501",
      })
    ).toBe("Lucas");
  });
});
