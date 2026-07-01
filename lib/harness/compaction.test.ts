import { describe, expect, it } from "vitest";
import { truncarResultadoFerramentaParaModelo } from "@/lib/harness/tool-output-truncate";
import { harnessCompactionApartirDe, harnessCompactionRecentes } from "@/lib/harness/compaction";

describe("harness tool-output-truncate", () => {
  it("não trunca JSON pequeno", () => {
    const raw = JSON.stringify({ ok: true, total: 2 });
    expect(truncarResultadoFerramentaParaModelo(raw)).toBe(raw);
  });

  it("trunca lista grande de registos", () => {
    const registos = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      nome: `Lead ${i}`,
      notas: "x".repeat(200),
    }));
    const raw = JSON.stringify({ ok: true, registos });
    const out = JSON.parse(truncarResultadoFerramentaParaModelo(raw, "hub_operacao_empresa")) as {
      harness_truncado?: boolean;
      total_registos?: number;
    };
    expect(out.harness_truncado).toBe(true);
    expect(out.total_registos).toBe(50);
  });
});

describe("harness compaction config", () => {
  it("defaults sensatos", () => {
    const prevA = process.env.HARNESS_COMPACTION_APARTIR;
    const prevR = process.env.HARNESS_COMPACTION_RECENTES;
    delete process.env.HARNESS_COMPACTION_APARTIR;
    delete process.env.HARNESS_COMPACTION_RECENTES;
    try {
      expect(harnessCompactionApartirDe()).toBe(20);
      expect(harnessCompactionRecentes()).toBe(12);
    } finally {
      if (prevA === undefined) delete process.env.HARNESS_COMPACTION_APARTIR;
      else process.env.HARNESS_COMPACTION_APARTIR = prevA;
      if (prevR === undefined) delete process.env.HARNESS_COMPACTION_RECENTES;
      else process.env.HARNESS_COMPACTION_RECENTES = prevR;
    }
  });
});
