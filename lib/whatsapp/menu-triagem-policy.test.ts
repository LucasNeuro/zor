import { describe, expect, it } from "vitest";
import {
  deveAnexarMenuTriagemAutomatico,
  mensagemPedidoConversacionalSemTriagem,
} from "@/lib/whatsapp/menu-triagem-policy";

describe("menu-triagem-policy", () => {
  it("detecta pedido de link sem triagem", () => {
    expect(mensagemPedidoConversacionalSemTriagem("Consegue me mandar o link novamente")).toBe(true);
  });

  it("não anexa menu após triagem enviada", () => {
    expect(
      deveAnexarMenuTriagemAutomatico({
        metadata: { wa_menu_triagem_enviado: true },
        mensagem: "Olá",
        isNovo: true,
      })
    ).toBe(false);
  });

  it("anexa menu só no primeiro olá", () => {
    expect(
      deveAnexarMenuTriagemAutomatico({
        metadata: {},
        mensagem: "Olá tudo bem",
        isNovo: true,
      })
    ).toBe(true);
  });

  it("não anexa menu quando cliente pede link", () => {
    expect(
      deveAnexarMenuTriagemAutomatico({
        metadata: {},
        mensagem: "manda o link da reunião",
        isNovo: false,
      })
    ).toBe(false);
  });
});
