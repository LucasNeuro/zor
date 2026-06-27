import { describe, expect, it } from "vitest";
import { deduplicarMemoriasParaPrompt } from "@/lib/ia/memoria-lead";

describe("deduplicarMemoriasParaPrompt", () => {
  it("mantém só o primeiro nome (mais recente)", () => {
    const out = deduplicarMemoriasParaPrompt([
      { chave: "nome", valor: "Marcelo" },
      { chave: "nome_auto", valor: "Renato" },
      { chave: "interesse_auto", valor: "Demo" },
    ]);
    expect(out).toEqual([
      { chave: "nome", valor: "Marcelo" },
      { chave: "interesse_auto", valor: "Demo" },
    ]);
  });
});
