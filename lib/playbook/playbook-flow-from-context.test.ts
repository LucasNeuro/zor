import { describe, expect, it } from "vitest";
import { buildPlaybookFlowFromSnapshot } from "./playbook-flow-from-context";
import type { AgentPlaybookSnapshotV1 } from "./agent-snapshot";
import { validatePlaybookFlowDefinition } from "./flow-validate";

function snapshotMinimo(): AgentPlaybookSnapshotV1 {
  return {
    agente_slug: "dhe",
    identity: { nome: "Dhé", tenant_id: "b6556af6-acc5-4d07-8c48-2609734e43b2" },
    cargo_catalogo: {
      titulo: "Atendimento",
      saudacao_cliente: "Olá! Sou Dhé.",
      perguntas_essenciais: ["O que você busca?"],
    },
    conhecimento: [
      { secao: "empresa", conteudo: "Empresa de serviços" },
      { secao: "servicos", conteudo: "- Consultoria\n- Suporte" },
      { secao: "atendimento", conteudo: "Atendimento humanizado." },
    ],
  };
}

describe("buildPlaybookFlowFromSnapshot", () => {
  it("não gera steps órfãos para ramos não usados no menu", () => {
    const { definition } = buildPlaybookFlowFromSnapshot(snapshotMinimo(), {
      nicho: "Serviços",
      segmentos: ["B2B"],
      nome_empresa: "Waje",
    });

    const validated = validatePlaybookFlowDefinition(definition);
    expect(validated.ok).toBe(true);
    if (!validated.ok) {
      throw new Error(validated.errors.join("; "));
    }

    const ids = new Set(definition.steps.map((s) => s.id));
    const menu = definition.steps.find((s) => s.id === "triagem_inicial_menu");
    expect(menu?.kind).toBe("menu");
    if (menu?.kind === "menu") {
      for (const opt of menu.options) {
        if (opt.next) expect(ids.has(opt.next)).toBe(true);
      }
    }
  });
});
