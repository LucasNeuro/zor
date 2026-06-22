import { describe, expect, it } from "vitest";
import {
  mensagemJaIndicaIntentTriagem,
  mensagemPedeCardapioOuPreco,
} from "@/lib/whatsapp/menu-intent";

describe("mensagemJaIndicaIntentTriagem", () => {
  it("detecta pedido de comida", () => {
    expect(mensagemJaIndicaIntentTriagem("Gostaria de fazer um pedido")).toBe(true);
    expect(mensagemJaIndicaIntentTriagem("quero delivery")).toBe(true);
  });

  it("ignora saudação simples", () => {
    expect(mensagemJaIndicaIntentTriagem("Olá")).toBe(false);
  });
});

describe("mensagemPedeCardapioOuPreco", () => {
  it("detecta pedido de cardápio", () => {
    expect(mensagemPedeCardapioOuPreco("Cadê o cardápio")).toBe(true);
    expect(mensagemPedeCardapioOuPreco("quero ver o menu")).toBe(true);
    expect(mensagemPedeCardapioOuPreco("qual o preço do marmitex")).toBe(true);
  });

  it("ignora mensagens genéricas", () => {
    expect(mensagemPedeCardapioOuPreco("Olá")).toBe(false);
    expect(mensagemPedeCardapioOuPreco("quero delivery")).toBe(false);
  });
});
