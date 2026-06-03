import { describe, expect, it } from "vitest";
import type { PlaybookFlowDefinition } from "./flow-definition-types";
import {
  flowDefinitionToGraph,
  graphToFlowDefinition,
  validateFlowGraph,
  type FlowVisualGraph,
} from "./flow-visual";

const VALID_DEF: PlaybookFlowDefinition = {
  obra10_playbook_flow_schema: 1,
  id: "flow_teste",
  version: "2026-06-03",
  entry_step_id: "inicio",
  journeys: ["triagem"],
  steps: [
    {
      id: "inicio",
      kind: "message",
      title: "Inicio",
      message: "Olá!",
      next: "menu_1",
      crm_patch: { tags_add: ["novo"] },
    },
    {
      id: "menu_1",
      kind: "menu",
      prompt: "Escolha",
      field: "area_interesse",
      on_select: { op_a: "input_email" },
      options: [
        {
          id: "op_a",
          label: "Arquitetura",
          next: "input_email",
          crm_patch: { fluxo_ativo: "arquitetura" },
        },
        {
          id: "op_b",
          label: "Finalizar",
          complete: { type: "complete", summary: "Concluído no menu." },
        },
      ],
    },
    {
      id: "input_email",
      kind: "input",
      prompt: "Seu e-mail?",
      field: "email",
      input_type: "email",
      next: "done",
      crm_patch: { metadata: { origem: "site" } },
    },
    {
      id: "done",
      kind: "complete",
      complete: { type: "complete", summary: "Obrigado!" },
    },
  ],
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("flowDefinitionToGraph / graphToFlowDefinition", () => {
  it("faz roundtrip preservando campos importantes", () => {
    const graph = flowDefinitionToGraph(clone(VALID_DEF));
    const rebuilt = graphToFlowDefinition(graph, {
      id: VALID_DEF.id,
      version: VALID_DEF.version,
      journeys: VALID_DEF.journeys,
    });

    expect(rebuilt.entry_step_id).toBe("inicio");
    expect(rebuilt.steps).toHaveLength(4);
    expect(rebuilt.id).toBe("flow_teste");
    expect(rebuilt.version).toBe("2026-06-03");
    expect(rebuilt.journeys).toEqual(["triagem"]);

    const menu = rebuilt.steps.find((step) => step.id === "menu_1");
    expect(menu?.kind).toBe("menu");
    if (menu?.kind !== "menu") return;
    expect(menu.field).toBe("area_interesse");
    expect(menu.on_select).toEqual({ op_a: "input_email" });
    expect(menu.options.find((o) => o.id === "op_a")?.crm_patch).toEqual({
      fluxo_ativo: "arquitetura",
    });

    const input = rebuilt.steps.find((step) => step.id === "input_email");
    expect(input?.kind).toBe("input");
    if (input?.kind !== "input") return;
    expect(input.field).toBe("email");
    expect(input.crm_patch).toEqual({ metadata: { origem: "site" } });
  });

  it("prioriza edges na reconstrução de next/options", () => {
    const graph = flowDefinitionToGraph(clone(VALID_DEF));
    graph.edges = graph.edges.map((edge) => {
      if (edge.kind === "next" && edge.from === "inicio") {
        return { ...edge, to: "input_email" };
      }
      if (edge.kind === "option_next" && edge.from === "menu_1" && edge.option_id === "op_a") {
        return { ...edge, to: "done" };
      }
      return edge;
    });

    const rebuilt = graphToFlowDefinition(graph, { validate: false });
    const inicio = rebuilt.steps.find((step) => step.id === "inicio");
    expect(inicio?.kind).toBe("message");
    if (inicio?.kind !== "message") return;
    expect(inicio.next).toBe("input_email");

    const menu = rebuilt.steps.find((step) => step.id === "menu_1");
    expect(menu?.kind).toBe("menu");
    if (menu?.kind !== "menu") return;
    expect(menu.options.find((o) => o.id === "op_a")?.next).toBe("done");
  });
});

describe("validateFlowGraph", () => {
  function baseGraph(): FlowVisualGraph {
    return flowDefinitionToGraph(clone(VALID_DEF));
  }

  it("valida entry_step_id existente", () => {
    const graph = baseGraph();
    graph.entry_step_id = "nao_existe";
    const result = validateFlowGraph(graph);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('entry_step_id "nao_existe"'))).toBe(true);
  });

  it("detecta ids duplicados", () => {
    const graph = baseGraph();
    graph.nodes.push({
      ...clone(graph.nodes[0]),
      step: { ...clone(graph.nodes[0].step) },
    });
    const result = validateFlowGraph(graph);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('Step id duplicado: "inicio"'))).toBe(true);
  });

  it("valida next e options.next apontando para steps existentes", () => {
    const graph = baseGraph();
    graph.edges = graph.edges.map((edge) => {
      if (edge.kind === "next" && edge.from === "inicio") {
        return { ...edge, to: "fantasma" };
      }
      if (edge.kind === "option_next" && edge.from === "menu_1" && edge.option_id === "op_a") {
        return { ...edge, to: "sumiu" };
      }
      return edge;
    });
    const result = validateFlowGraph(graph);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('Step "inicio" aponta para destino inexistente: "fantasma"'))).toBe(
      true
    );
    expect(result.errors.some((e) => e.includes('Step "menu_1" aponta para destino inexistente: "sumiu"'))).toBe(
      true
    );
  });

  it("exige pelo menos um complete", () => {
    const graph = baseGraph();
    graph.nodes = graph.nodes.map((node) => {
      if (node.step.kind === "complete") {
        return {
          ...node,
          step: {
            id: node.id,
            kind: "message",
            message: "sem conclusão",
          },
        };
      }
      if (node.step.kind === "message") {
        const step = { ...node.step };
        delete step.complete;
        return { ...node, step };
      }
      if (node.step.kind === "input") {
        const step = { ...node.step };
        delete step.complete;
        return { ...node, step };
      }
      if (node.step.kind === "menu") {
        return {
          ...node,
          step: {
            ...node.step,
            options: node.step.options.map((option) => {
              const cloneOption = { ...option };
              delete cloneOption.complete;
              return cloneOption;
            }),
          },
        };
      }
      return node;
    });

    const result = validateFlowGraph(graph);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) =>
        e.includes("Fluxo inválido: deve existir ao menos um passo de conclusão (complete).")
      )
    ).toBe(true);
  });

  it("detecta step órfão (não alcançável do entry)", () => {
    const graph = baseGraph();
    graph.nodes.push({
      id: "isolado",
      step: {
        id: "isolado",
        kind: "message",
        message: "Nunca alcançado",
      },
    });
    const result = validateFlowGraph(graph);
    expect(result.ok).toBe(false);
    expect(result.orphan_step_ids).toContain("isolado");
    expect(result.errors.some((e) => e.includes("Steps órfãos"))).toBe(true);
  });
});
