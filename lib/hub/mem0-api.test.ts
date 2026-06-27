import { describe, expect, it } from "vitest";
import { normalizarMem0SearchResults } from "@/lib/hub/mem0-api";
import { formatarBlocoMem0SuperMemoria, mem0SuperMemoriaAtiva } from "@/lib/hub/mem0-super-memoria";
import { MEM0_SUPER_MEMORIA_KEY } from "@/lib/hub/mem0-constants";

describe("mem0-api", () => {
  it("normaliza results v3", () => {
    const hits = normalizarMem0SearchResults({
      results: [{ id: "1", memory: "Cliente prefere demo à tarde", score: 0.9 }],
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.memory).toContain("demo");
  });
});

describe("mem0-super-memoria", () => {
  it("detecta toggle super memória (exige MEM0_API_KEY)", () => {
    const prev = process.env.MEM0_API_KEY;
    process.env.MEM0_API_KEY = "test-key-mem0";
    try {
      expect(mem0SuperMemoriaAtiva({ [MEM0_SUPER_MEMORIA_KEY]: true })).toBe(true);
      expect(mem0SuperMemoriaAtiva({})).toBe(false);
      expect(mem0SuperMemoriaAtiva({ [MEM0_SUPER_MEMORIA_KEY]: true })).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.MEM0_API_KEY;
      else process.env.MEM0_API_KEY = prev;
    }
    delete process.env.MEM0_API_KEY;
    expect(mem0SuperMemoriaAtiva({ [MEM0_SUPER_MEMORIA_KEY]: true })).toBe(false);
  });

  it("formata bloco prompt", () => {
    const bloco = formatarBlocoMem0SuperMemoria([{ memory: "Nome: Marcelo" }]);
    expect(bloco).toContain("SUPER MEMÓRIA");
    expect(bloco).toContain("Marcelo");
  });
});
