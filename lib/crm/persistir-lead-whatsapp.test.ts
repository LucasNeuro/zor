import { describe, expect, it } from "vitest";
import { memoriasParaPatchCrm } from "@/lib/crm/persistir-lead-whatsapp";

describe("memoriasParaPatchCrm", () => {
  it("usa o nome mais recente quando a lista vem por criado_em desc", () => {
    const { args } = memoriasParaPatchCrm([
      { chave: "nome", valor: "Marcelo" },
      { chave: "nome", valor: "Renato" },
    ]);
    expect(args.nome).toBe("Marcelo");
  });

  it("normaliza nome_auto e ignora duplicatas antigas", () => {
    const { args } = memoriasParaPatchCrm([
      { chave: "nome_auto", valor: "Ana" },
      { chave: "nome", valor: "Lead WhatsApp" },
    ]);
    expect(args.nome).toBe("Ana");
  });

  it("usa interesse mais recente na mesma ordem", () => {
    const { args } = memoriasParaPatchCrm([
      { chave: "interesse", valor: "Demo amanhã" },
      { chave: "interesse_auto", valor: "Orçamento antigo" },
    ]);
    expect(args.interesse_principal).toBe("Demo amanhã");
    expect(args.estagio).toBe("qualificando");
  });
});
