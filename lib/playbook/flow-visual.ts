import {
  OBRA10_PLAYBOOK_FLOW_SCHEMA_VERSION,
  type Obra10PlaybookFlowSchemaVersion,
  type PlaybookFlowDefinition,
  type PlaybookFlowJourney,
  type PlaybookFlowStep,
} from "./flow-definition-types";

export type FlowGraphEdgeKind = "next" | "option_next" | "on_select";

export type FlowGraphNode = {
  id: string;
  step: PlaybookFlowStep;
  position?: { x: number; y: number };
};

export type FlowGraphEdge = {
  id: string;
  from: string;
  to: string;
  kind: FlowGraphEdgeKind;
  option_id?: string;
};

export type FlowVisualGraph = {
  entry_step_id: string;
  nodes: FlowGraphNode[];
  edges: FlowGraphEdge[];
};

export type ValidateFlowGraphResult = {
  ok: boolean;
  errors: string[];
  orphan_step_ids: string[];
};

export type GraphToFlowDefinitionOptions = {
  schema_version?: Obra10PlaybookFlowSchemaVersion;
  id?: string;
  version?: string;
  journeys?: PlaybookFlowJourney[];
  entry_step_id?: string;
  validate?: boolean;
};

function deepClone<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export function edgeId(kind: FlowGraphEdgeKind, from: string, to: string, optionId?: string): string {
  const base = `${kind}:${from}->${to}`;
  return optionId ? `${base}#${optionId}` : base;
}

function collectTargets(step: PlaybookFlowStep): string[] {
  const targets: string[] = [];
  if ("next" in step && typeof step.next === "string" && step.next.trim()) {
    targets.push(step.next.trim());
  }
  if (step.kind === "menu") {
    for (const option of step.options) {
      if (typeof option.next === "string" && option.next.trim()) {
        targets.push(option.next.trim());
      }
    }
    if (step.on_select) {
      for (const value of Object.values(step.on_select)) {
        if (typeof value === "string" && value.trim()) {
          targets.push(value.trim());
        }
      }
    }
  }
  return targets;
}

function hasAnyComplete(definition: PlaybookFlowDefinition): boolean {
  for (const step of definition.steps) {
    if (step.kind === "complete") return true;
    if ("complete" in step && step.complete) return true;
    if (step.kind === "menu") {
      for (const option of step.options) {
        if (option.complete) return true;
      }
    }
  }
  return false;
}

function buildEdgeMaps(
  edges: FlowGraphEdge[]
): {
  nextEdge: Map<string, string>;
  optionNextEdge: Map<string, string>;
  onSelectEdge: Map<string, string>;
} {
  const nextEdge = new Map<string, string>();
  const optionNextEdge = new Map<string, string>();
  const onSelectEdge = new Map<string, string>();

  for (const edge of edges) {
    if (!edge.from || !edge.to) continue;
    if (edge.kind === "next") {
      nextEdge.set(edge.from, edge.to);
      continue;
    }
    if (!edge.option_id) continue;
    const key = `${edge.from}::${edge.option_id}`;
    if (edge.kind === "option_next") {
      optionNextEdge.set(key, edge.to);
      continue;
    }
    if (edge.kind === "on_select") {
      onSelectEdge.set(key, edge.to);
    }
  }

  return { nextEdge, optionNextEdge, onSelectEdge };
}

function buildDefinitionFromGraph(
  graph: FlowVisualGraph,
  opts?: GraphToFlowDefinitionOptions
): PlaybookFlowDefinition {
  const nodes = graph.nodes.map((node) => deepClone(node));
  const edges = graph.edges.map((edge) => deepClone(edge));
  const { nextEdge, optionNextEdge, onSelectEdge } = buildEdgeMaps(edges);

  const steps: PlaybookFlowStep[] = nodes.map((node) => {
    const step = deepClone(node.step) as PlaybookFlowStep;
    step.id = node.id;

    if (step.kind === "message" || step.kind === "input") {
      const next = nextEdge.get(node.id);
      if (next) {
        step.next = next;
      } else {
        delete step.next;
      }
      return step;
    }

    if (step.kind === "menu") {
      step.options = step.options.map((option) => {
        const optionClone = deepClone(option);
        const key = `${node.id}::${option.id}`;
        const next = optionNextEdge.get(key);
        if (next) {
          optionClone.next = next;
        } else {
          delete optionClone.next;
        }
        return optionClone;
      });

      const updatedOnSelect: Record<string, string> = {};
      let hasOnSelectFromGraph = false;
      for (const option of step.options) {
        const key = `${node.id}::${option.id}`;
        const onSelectTarget = onSelectEdge.get(key);
        if (onSelectTarget) {
          updatedOnSelect[option.id] = onSelectTarget;
          hasOnSelectFromGraph = true;
        }
      }

      if (hasOnSelectFromGraph) {
        step.on_select = updatedOnSelect;
      }
      return step;
    }

    return step;
  });

  const definition: PlaybookFlowDefinition = {
    obra10_playbook_flow_schema:
      opts?.schema_version ?? OBRA10_PLAYBOOK_FLOW_SCHEMA_VERSION,
    entry_step_id: opts?.entry_step_id ?? graph.entry_step_id,
    steps,
  };

  if (opts?.id) definition.id = opts.id;
  if (opts?.version) definition.version = opts.version;
  if (opts?.journeys) definition.journeys = [...opts.journeys];

  return definition;
}

export function flowDefinitionToGraph(def: PlaybookFlowDefinition): FlowVisualGraph {
  const nodes: FlowGraphNode[] = def.steps.map((step) => ({
    id: step.id,
    step: deepClone(step),
  }));

  const edges: FlowGraphEdge[] = [];
  for (const step of def.steps) {
    const from = step.id;
    if ("next" in step && typeof step.next === "string" && step.next.trim()) {
      const to = step.next.trim();
      edges.push({
        id: edgeId("next", from, to),
        from,
        to,
        kind: "next",
      });
    }
    if (step.kind === "menu") {
      for (const option of step.options) {
        if (typeof option.next === "string" && option.next.trim()) {
          const to = option.next.trim();
          edges.push({
            id: edgeId("option_next", from, to, option.id),
            from,
            to,
            kind: "option_next",
            option_id: option.id,
          });
        }
      }
      if (step.on_select) {
        for (const [optionId, target] of Object.entries(step.on_select)) {
          if (!target?.trim()) continue;
          const to = target.trim();
          edges.push({
            id: edgeId("on_select", from, to, optionId),
            from,
            to,
            kind: "on_select",
            option_id: optionId,
          });
        }
      }
    }
  }

  return {
    entry_step_id: def.entry_step_id,
    nodes,
    edges,
  };
}

export function graphToFlowDefinition(
  graph: FlowVisualGraph,
  opts?: GraphToFlowDefinitionOptions
): PlaybookFlowDefinition {
  const definition = buildDefinitionFromGraph(graph, opts);
  if (opts?.validate === false) {
    return definition;
  }
  const validation = validateFlowGraph(graph);
  if (!validation.ok) {
    throw new Error(validation.errors.join(" "));
  }
  return definition;
}

export function validateFlowGraph(graph: FlowVisualGraph): ValidateFlowGraphResult {
  const errors: string[] = [];
  const orphanStepIds: string[] = [];

  if (!graph || typeof graph !== "object") {
    return {
      ok: false,
      errors: ["Grafo inválido: payload não é objeto."],
      orphan_step_ids: [],
    };
  }

  if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    errors.push("Grafo inválido: nodes deve ser um array com itens.");
  }

  const idCount = new Map<string, number>();
  for (const node of graph.nodes || []) {
    const id = node?.id?.trim();
    if (!id) {
      errors.push("Step sem id encontrado no grafo.");
      continue;
    }
    idCount.set(id, (idCount.get(id) ?? 0) + 1);
  }
  for (const [id, count] of idCount.entries()) {
    if (count > 1) {
      errors.push(`Step id duplicado: "${id}".`);
    }
  }

  const stepIds = new Set(idCount.keys());
  const entry = typeof graph.entry_step_id === "string" ? graph.entry_step_id.trim() : "";
  if (!entry) {
    errors.push('Campo obrigatório inválido: "entry_step_id".');
  } else if (!stepIds.has(entry)) {
    errors.push(`entry_step_id "${entry}" não existe em steps.`);
  }

  for (const edge of graph.edges || []) {
    const from = edge?.from?.trim();
    const to = edge?.to?.trim();
    if (!from || !to) continue;
    if (!stepIds.has(from)) {
      errors.push(`Aresta com origem inexistente: "${from}".`);
    }
    if (!stepIds.has(to)) {
      errors.push(`Aresta com destino inexistente: "${to}".`);
    }
  }

  const definition = buildDefinitionFromGraph(graph, { validate: false });
  for (const step of definition.steps) {
    const targets = collectTargets(step);
    for (const target of targets) {
      if (!stepIds.has(target)) {
        errors.push(`Step "${step.id}" aponta para destino inexistente: "${target}".`);
      }
    }
  }

  if (!hasAnyComplete(definition)) {
    errors.push("Fluxo inválido: deve existir ao menos um passo de conclusão (complete).");
  }

  if (entry && stepIds.has(entry)) {
    const adjacency = new Map<string, string[]>();
    for (const step of definition.steps) {
      adjacency.set(step.id, collectTargets(step));
    }

    const visited = new Set<string>();
    const queue = [entry];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) continue;
      visited.add(current);
      for (const next of adjacency.get(current) ?? []) {
        if (!visited.has(next)) {
          queue.push(next);
        }
      }
    }

    for (const id of stepIds) {
      if (!visited.has(id)) {
        orphanStepIds.push(id);
      }
    }
    if (orphanStepIds.length > 0) {
      errors.push(`Steps órfãos (não alcançáveis do entry): ${orphanStepIds.join(", ")}.`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    orphan_step_ids: orphanStepIds,
  };
}
