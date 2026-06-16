import { describe, expect, it } from "vitest";
import {
  extrairDemandaServicoCliente,
  extrairOrcamentosDosTextos,
} from "@/lib/crm/contexto-negocio-conversa";

describe("contexto-negocio-conversa", () => {
  it("extrai orçamento com valor R$ da conversa", () => {
    const orcs = extrairOrcamentosDosTextos([
      "Cliente: meu celular não liga",
      "Atendente: O orçamento para conserto fica R$ 285,00 com peça inclusa.",
    ]);
    expect(orcs.length).toBeGreaterThan(0);
    expect(orcs[0]?.valor).toBe(285);
  });

  it("extrai demanda de serviço do cliente", () => {
    const demanda = extrairDemandaServicoCliente(
      [{ role: "user", content: "Preciso de conserto no celular, tela quebrada" }],
      []
    );
    expect(demanda?.toLowerCase()).toContain("conserto");
  });
});
