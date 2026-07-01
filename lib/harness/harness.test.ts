import { describe, expect, it } from "vitest";
import { classifyHarnessOutcome } from "@/lib/harness/classify-outcome";
import { extrairUrlsPublicasDeResultadoFerramenta } from "@/lib/harness/extrair-urls-publicas";
import { harnessV1Enabled } from "@/lib/harness/feature-flag";
import { verificarResultadoFerramenta } from "@/lib/harness/loop/verify-tool-result";
import { resolverAgenteSlugParaLead } from "@/lib/harness/resolve-lead-agente";
import { HARNESS_RUNTIME_ID, HARNESS_VERSION } from "@/lib/harness/types";
import { wajeMistralRuntimeId } from "@/lib/harness/runtime/waje-mistral-v1";

describe("harness classify-outcome", () => {
  it("classifica texto do assistente", () => {
    expect(classifyHarnessOutcome({ texto: "Olá" })).toBe("assistant_text");
  });

  it("classifica vazio", () => {
    expect(classifyHarnessOutcome({ texto: "  " })).toBe("empty");
  });

  it("classifica erro de prompt", () => {
    expect(classifyHarnessOutcome({ promptError: "fail" })).toBe("error");
  });
});

describe("harness extrair-urls-publicas", () => {
  it("extrai url_publica do JSON da tool", () => {
    const urls = extrairUrlsPublicasDeResultadoFerramenta(
      JSON.stringify({ ok: true, url_publica: "https://example.com/r.html" })
    );
    expect(urls).toEqual(["https://example.com/r.html"]);
  });
});

describe("harness feature-flag", () => {
  it("activo por defeito", () => {
    const prev = process.env.HARNESS_V1_ENABLED;
    delete process.env.HARNESS_V1_ENABLED;
    try {
      expect(harnessV1Enabled()).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.HARNESS_V1_ENABLED;
      else process.env.HARNESS_V1_ENABLED = prev;
    }
  });

  it("desactiva com HARNESS_V1_ENABLED=false", () => {
    const prev = process.env.HARNESS_V1_ENABLED;
    process.env.HARNESS_V1_ENABLED = "false";
    try {
      expect(harnessV1Enabled()).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.HARNESS_V1_ENABLED;
      else process.env.HARNESS_V1_ENABLED = prev;
    }
  });
});

describe("harness resolve-lead-agente", () => {
  it("prioriza transfer_agente_destino no metadata", () => {
    expect(
      resolverAgenteSlugParaLead({
        agente_responsavel: "sdr",
        metadata: { transfer_agente_destino: "lucca" },
      })
    ).toBe("lucca");
  });
});

describe("harness verify-tool-result", () => {
  it("detecta ok:true", () => {
    const v = verificarResultadoFerramenta(JSON.stringify({ ok: true, total: 3 }));
    expect(v.ok).toBe(true);
    expect(v.outcome).toBe("ok");
  });

  it("detecta erro", () => {
    const v = verificarResultadoFerramenta(JSON.stringify({ ok: false, erro: "falhou" }));
    expect(v.ok).toBe(false);
  });
});

describe("harness runtime metadata", () => {
  it("expõe id e versão estáveis", () => {
    expect(wajeMistralRuntimeId()).toBe(HARNESS_RUNTIME_ID);
    expect(HARNESS_VERSION).toBe("0.2.0");
  });
});
