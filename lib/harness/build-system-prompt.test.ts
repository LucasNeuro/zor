import { describe, expect, it } from "vitest";
import {
  gerarCapabilityBloco,
  montarSystemPromptHarness,
} from "@/lib/harness/build-system-prompt";

const BLOCOS_XML = [
  "waje_intro",
  "language_settings",
  "system_capability",
  "agent_loop",
  "harness_modes",
  "tool_use_rules",
  "crm_rules",
  "event_stream",
  "skills_context",
  "identity_context",
] as const;

describe("montarSystemPromptHarness — contrato Manus-style", () => {
  it("inclui todos os blocos XML obrigatórios", () => {
    const prompt = montarSystemPromptHarness({
      agenteNome: "Lucca QA",
      agenteSlug: "lucca-qa",
      cargo: "SDR",
      canalInterno: "copiloto_crm",
      toolsetsAtivos: ["crm_operacoes", "artefatos"],
    });

    for (const tag of BLOCOS_XML) {
      expect(prompt).toContain(`<${tag}>`);
      expect(prompt).toContain(`</${tag}>`);
    }
  });

  it("<system_capability> lista só toolsets activos", () => {
    const comCrm = montarSystemPromptHarness({
      agenteNome: "A",
      agenteSlug: "a",
      canalInterno: "copiloto_crm",
      toolsetsAtivos: ["crm_operacoes"],
    });
    expect(comCrm).toMatch(/Consultar e gravar entidades CRM/i);
    expect(comCrm).not.toMatch(/Publicar dashboards canvas/i);

    const comArtefacto = montarSystemPromptHarness({
      agenteNome: "A",
      agenteSlug: "a",
      canalInterno: "copiloto_crm",
      toolsetsAtivos: ["artefatos"],
    });
    expect(comArtefacto).toMatch(/Publicar dashboards canvas/i);
    expect(comArtefacto).not.toMatch(/Consultar e gravar entidades CRM/i);
  });

  it("<event_stream> documenta tipos Message/Action/Observation/Plan/Knowledge", () => {
    const prompt = montarSystemPromptHarness({
      agenteNome: "A",
      agenteSlug: "a",
      canalInterno: "copiloto_crm",
    });
    expect(prompt).toMatch(/Message/i);
    expect(prompt).toMatch(/Action/i);
    expect(prompt).toMatch(/Observation/i);
    expect(prompt).toMatch(/Plan/i);
    expect(prompt).toMatch(/Knowledge/i);
  });

  it("inclui integradores activos em system_capability", () => {
    const bloco = gerarCapabilityBloco(["crm_operacoes"], [], ["gmail_enviar", "gcal_listar"]);
    expect(bloco).toMatch(/Integradores activos: gmail_enviar, gcal_listar/);
  });
});
