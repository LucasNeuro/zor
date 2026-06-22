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
  it("gera menu delivery com 3 opções para restaurante", () => {
    const snap = snapshotMinimo();
    snap.conhecimento = [
      { secao: "empresa", conteudo: "Cantina Nova — restaurante com delivery" },
      { secao: "servicos", conteudo: "- Delivery de refeições\n- Retirada no balcão" },
      { secao: "atendimento", conteudo: "Atendimento por WhatsApp." },
    ];
    const { definition, resumo } = buildPlaybookFlowFromSnapshot(snap, {
      nicho: "Restaurante e delivery",
      segmentos: ["alimentação fora do lar"],
      nome_empresa: "Cantina Nova",
    });
    const menu = definition.steps.find((s) => s.id === "triagem_inicial_menu");
    expect(menu?.kind).toBe("menu");
    if (menu?.kind === "menu") {
      const labels = menu.options.map((o) => o.label);
      expect(labels.some((l) => /pedido|delivery/i.test(l))).toBe(true);
      expect(labels.some((l) => /balcão|retirar/i.test(l))).toBe(true);
      expect(labels.some((l) => /cardápio/i.test(l))).toBe(true);
      expect(labels.some((l) => /alimentação fora do lar/i.test(l))).toBe(false);
    }
    expect(resumo.opcoes_triagem.some((l) => /delivery/i.test(l))).toBe(true);
  });

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
