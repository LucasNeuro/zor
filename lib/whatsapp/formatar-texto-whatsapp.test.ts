import { describe, expect, it } from "vitest";
import {
  corrigirLinksMeetNaResposta,
  extrairLinkMeetDeToolCalls,
  formatarTextoRespostaWhatsapp,
  prepararTextoIaParaWhatsapp,
} from "./formatar-texto-whatsapp";

describe("formatarTextoRespostaWhatsapp", () => {
  it("converte link markdown em URL nua", () => {
    const in_ =
      "Acesse: [https://meet.google.com/abc-defg-hij](https://meet.google.com/abc-defg-hij)";
    expect(formatarTextoRespostaWhatsapp(in_)).toBe(
      "Acesse: https://meet.google.com/abc-defg-hij"
    );
  });

  it("converte negrito markdown", () => {
    expect(formatarTextoRespostaWhatsapp("**amanhã**")).toBe("*amanhã*");
  });
});

describe("extrairLinkMeetDeToolCalls", () => {
  it("lê link_para_whatsapp do JSON da tool", () => {
    const link = extrairLinkMeetDeToolCalls([
      {
        nome: "hub_int_gcal_criar_evento",
        ok: true,
        resultadoPreview: JSON.stringify({
          link_para_whatsapp: "https://meet.google.com/xyz-abcd-efg",
        }),
      },
    ]);
    expect(link).toBe("https://meet.google.com/xyz-abcd-efg");
  });
});

describe("corrigirLinksMeetNaResposta", () => {
  it("substitui meet inventado pelo oficial", () => {
    const out = corrigirLinksMeetNaResposta(
      "Link: https://meet.google.com/fake-fake-fake",
      "https://meet.google.com/real-real-real"
    );
    expect(out).toBe("Link: https://meet.google.com/real-real-real");
  });
});

describe("prepararTextoIaParaWhatsapp", () => {
  it("formata markdown e corrige meet", () => {
    const out = prepararTextoIaParaWhatsapp(
      "Demo **amanhã**: [https://meet.google.com/wrong-wrong-wrong](https://meet.google.com/wrong-wrong-wrong)",
      [
        {
          nome: "hub_int_gcal_criar_evento",
          ok: true,
          resultadoPreview: JSON.stringify({
            link_para_whatsapp: "https://meet.google.com/good-good-good",
          }),
        },
      ]
    );
    expect(out).toContain("https://meet.google.com/good-good-good");
    expect(out).not.toContain("wrong-wrong-wrong");
    expect(out).not.toContain("[https://");
  });
});
