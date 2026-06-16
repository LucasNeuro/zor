import { describe, expect, it } from "vitest";
import {
  formatarMensagemConsultorWhatsapp,
  textoExibicaoMensagemHumano,
} from "@/lib/crm/mensagem-consultor-whatsapp";

describe("mensagem-consultor-whatsapp", () => {
  it("formata tag Waje + consultor", () => {
    const out = formatarMensagemConsultorWhatsapp({
      texto: "Olá, tudo bem?",
      consultorNome: "Lucas",
    });
    expect(out).toBe("*[Waje · Lucas]*\nOlá, tudo bem?");
  });

  it("exibe texto original no CRM quando presente nos metadados", () => {
    const exib = textoExibicaoMensagemHumano("*[Waje · Ana]*\nOlá", { texto_original: "Olá" });
    expect(exib).toBe("Olá");
  });

  it("remove tag legada Consultor no CRM", () => {
    const exib = textoExibicaoMensagemHumano("*[Consultor Lucas — Zor]*\nola", {});
    expect(exib).toBe("ola");
  });
});
