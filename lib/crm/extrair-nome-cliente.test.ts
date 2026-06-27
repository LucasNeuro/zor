import { describe, expect, it } from "vitest";
import { extrairNomeClienteDaMensagem } from "@/lib/crm/extrair-nome-cliente";

describe("extrairNomeClienteDaMensagem", () => {
  it("extrai de frase completa", () => {
    expect(extrairNomeClienteDaMensagem("Meu nome é Ana Silva")).toBe("Ana Silva");
    expect(extrairNomeClienteDaMensagem("Sou Lucas, quero comprar")).toBe("Lucas");
  });

  it("aceita resposta curta (Marcelo)", () => {
    expect(extrairNomeClienteDaMensagem("Marcelo")).toBe("Marcelo");
    expect(extrairNomeClienteDaMensagem("Pedro")).toBe("Pedro");
  });

  it("rejeita saudação como nome", () => {
    expect(extrairNomeClienteDaMensagem("Oi")).toBeUndefined();
    expect(extrairNomeClienteDaMensagem("Bom dia")).toBeUndefined();
  });
});
