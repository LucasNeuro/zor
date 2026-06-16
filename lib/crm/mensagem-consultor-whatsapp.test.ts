import { describe, expect, it } from "vitest";
import {
  formatarMensagemConsultorWhatsapp,
  textoExibicaoMensagemHumano,
} from "@/lib/crm/mensagem-consultor-whatsapp";

describe("mensagem-consultor-whatsapp", () => {
  it("formata tag com consultor e negócio", () => {
    const out = formatarMensagemConsultorWhatsapp({
      texto: "Olá, tudo bem?",
      consultorNome: "Ana Silva",
      negocioNome: "Waje Digital",
    });
    expect(out).toBe("*[Consultor Ana Silva — Waje Digital]*\nOlá, tudo bem?");
  });

  it("exibe texto original no CRM quando presente nos metadados", () => {
    const exib = textoExibicaoMensagemHumano(
      "*[Consultor Ana — Waje]*\nOlá",
      { texto_original: "Olá" }
    );
    expect(exib).toBe("Olá");
  });
});
