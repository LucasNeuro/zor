import { describe, expect, it } from "vitest";
import {
  avaliarPoliticaHarnessTool,
  respostaJsonPoliticaHarness,
} from "@/lib/harness/tool-policy";

describe("tool-policy", () => {
  it("bloqueia escrita CRM em modo analisar", () => {
    const p = avaliarPoliticaHarnessTool({
      toolName: "hub_int_crm_ent_lead",
      argumentos: { acao: "criar" },
      modoId: "analisar",
      agenteInterno: true,
    });
    expect(p.permitido).toBe(false);
    if (!p.permitido) expect(p.motivo).toBe("modo_bloqueia_escrita");
  });

  it("exige aprovação em modo operar sem grant", () => {
    const p = avaliarPoliticaHarnessTool({
      toolName: "hub_operacao_empresa",
      argumentos: { acao: "atualizar" },
      modoId: "operar",
      grants: {},
      agenteInterno: true,
    });
    expect(p.permitido).toBe(false);
    if (!p.permitido) expect(p.motivo).toBe("aprovacao_necessaria");
  });

  it("permite escrita com grant na sessão", () => {
    const p = avaliarPoliticaHarnessTool({
      toolName: "hub_operacao_empresa",
      argumentos: { acao: "atualizar" },
      modoId: "operar",
      grants: { crm_escrita_sessao: true },
      agenteInterno: true,
    });
    expect(p.permitido).toBe(true);
  });

  it("serializa resposta JSON de política", () => {
    const p = avaliarPoliticaHarnessTool({
      toolName: "hub_int_crm_ent_lead",
      argumentos: { acao: "criar" },
      modoId: "conversar",
      agenteInterno: true,
    });
    if (p.permitido) throw new Error("expected block");
    const json = JSON.parse(respostaJsonPoliticaHarness(p));
    expect(json.harness_policy).toBe(true);
  });
});
