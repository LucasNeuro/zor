import { describe, expect, it } from "vitest";
import {
  BLOCO_MEMORIA_CONVERSA_HARNESS,
  formatarBlocoHistoricoCopiloto,
  resumoTurnoParaMemoria,
} from "@/lib/harness/historico-copiloto";

describe("historico-copiloto", () => {
  it("formata bloco com mensagens do thread", () => {
    const bloco = formatarBlocoHistoricoCopiloto([
      { papel: "user", conteudo: "Olá bom dia" },
      { papel: "assistant", conteudo: "Bom dia! Como posso ajudar?" },
    ]);
    expect(bloco).toContain("HISTÓRICO DESTA CONVERSA");
    expect(bloco).toContain("Gestor: Olá bom dia");
    expect(bloco).toContain("Assistente: Bom dia!");
  });

  it("retorna vazio sem histórico", () => {
    expect(formatarBlocoHistoricoCopiloto([])).toBe("");
  });

  it("gera linha de resumo para memória curada", () => {
    expect(resumoTurnoParaMemoria("preciso de um resumo", "Claro, aqui está.")).toContain("→");
  });

  it("bloco de memória menciona thread e memória curada", () => {
    expect(BLOCO_MEMORIA_CONVERSA_HARNESS).toMatch(/mensagens anteriores/i);
    expect(BLOCO_MEMORIA_CONVERSA_HARNESS).toMatch(/não tem registo de conversas/i);
  });
});
