import { describe, expect, it } from "vitest";
import { extrairWhatsappMessageIdDeRespostaUazapi } from "@/lib/whatsapp/uazapi-response";

describe("extrairWhatsappMessageIdDeRespostaUazapi", () => {
  it("extrai id no root", () => {
    expect(
      extrairWhatsappMessageIdDeRespostaUazapi({ id: "5511914589862:3EB0ADC83CD143DA48CA67" })
    ).toBe("5511914589862:3EB0ADC83CD143DA48CA67");
  });

  it("extrai id em data", () => {
    expect(
      extrairWhatsappMessageIdDeRespostaUazapi({
        data: { messageId: "ABC123XYZ" },
      })
    ).toBe("ABC123XYZ");
  });

  it("retorna null sem id", () => {
    expect(extrairWhatsappMessageIdDeRespostaUazapi({ ok: true })).toBeNull();
  });
});
