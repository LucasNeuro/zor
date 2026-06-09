import {
  type PlaybookFlowCompleteAction,
  type PlaybookFlowDefinition,
  type PlaybookFlowMenuOption,
  type PlaybookFlowStep,
} from "./flow-definition-types";
import {
  PLAYBOOK_FLOW_SCHEMA_KEY,
  PLAYBOOK_FLOW_SCHEMA_KEY_LEGACY,
  PLAYBOOK_FLOW_SCHEMA_VERSION,
} from "./flow-schema";

export type ValidatePlaybookFlowResult =
  | { ok: true; definition: PlaybookFlowDefinition }
  | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateCompleteAction(
  complete: PlaybookFlowCompleteAction | undefined,
  where: string,
  errors: string[]
) {
  if (!complete) return;
  if (complete.type !== "complete") {
    errors.push(`${where}: ação de conclusão deve ter type="complete".`);
  }
  if (complete.crm_patch !== undefined && !isRecord(complete.crm_patch)) {
    errors.push(`${where}: crm_patch deve ser um objeto.`);
  }
}

function collectNextTargets(step: PlaybookFlowStep): string[] {
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
    if (step.on_select && isRecord(step.on_select)) {
      for (const next of Object.values(step.on_select)) {
        if (typeof next === "string" && next.trim()) {
          targets.push(next.trim());
        }
      }
    }
  }
  return targets;
}

function validateMenuOptions(step: PlaybookFlowStep, errors: string[]) {
  if (step.kind !== "menu") return;
  if (!Array.isArray(step.options) || step.options.length === 0) {
    errors.push(`Step "${step.id}" (${step.kind}) deve ter ao menos uma opção em options.`);
    return;
  }

  const optionIds = new Set<string>();
  for (const option of step.options as PlaybookFlowMenuOption[]) {
    if (!option.id?.trim()) {
      errors.push(`Step "${step.id}" (${step.kind}) possui opção sem id.`);
      continue;
    }
    if (optionIds.has(option.id)) {
      errors.push(`Step "${step.id}" (${step.kind}) possui option id duplicado: "${option.id}".`);
    }
    optionIds.add(option.id);

    if (!option.label?.trim()) {
      errors.push(`Step "${step.id}" (${step.kind}) opção "${option.id}" sem label.`);
    }

    const hasNext = typeof option.next === "string" && option.next.trim().length > 0;
    const hasComplete = Boolean(option.complete);
    if (!hasNext && !hasComplete) {
      errors.push(
        `Step "${step.id}" (${step.kind}) opção "${option.id}" precisa de "next" ou "complete".`
      );
    }
    if (hasNext && hasComplete) {
      errors.push(
        `Step "${step.id}" (${step.kind}) opção "${option.id}" não pode ter "next" e "complete" juntos.`
      );
    }

    validateCompleteAction(
      option.complete,
      `Step "${step.id}" (${step.kind}) opção "${option.id}"`,
      errors
    );
  }

  if (step.on_select) {
    if (!isRecord(step.on_select)) {
      errors.push(`Step "${step.id}" (${step.kind}) on_select deve ser um objeto.`);
      return;
    }
    for (const [choiceId, next] of Object.entries(step.on_select)) {
      if (!optionIds.has(choiceId)) {
        errors.push(
          `Step "${step.id}" (${step.kind}) on_select referencia opção inexistente: "${choiceId}".`
        );
      }
      if (typeof next !== "string" || !next.trim()) {
        errors.push(
          `Step "${step.id}" (${step.kind}) on_select["${choiceId}"] deve apontar para um step id válido.`
        );
      }
    }
  }
}

function validateStepInternalSemantics(step: PlaybookFlowStep, errors: string[]) {
  if (!step.id?.trim()) {
    errors.push(`Step sem id encontrado.`);
    return;
  }

  if (step.crm_patch !== undefined && !isRecord(step.crm_patch)) {
    errors.push(`Step "${step.id}" (${step.kind}) crm_patch deve ser objeto.`);
  }

  if ("complete" in step) {
    validateCompleteAction(step.complete as PlaybookFlowCompleteAction | undefined, `Step "${step.id}"`, errors);
  }

  if (step.kind === "menu") {
    if (!step.prompt?.trim()) {
      errors.push(`Step "${step.id}" (${step.kind}) sem prompt.`);
    }
    validateMenuOptions(step, errors);
    return;
  }

  if (step.kind === "message") {
    if (!step.message?.trim()) {
      errors.push(`Step "${step.id}" (${step.kind}) sem message.`);
    }
  }

  if (step.kind === "input") {
    if (!step.prompt?.trim()) {
      errors.push(`Step "${step.id}" (${step.kind}) sem prompt.`);
    }
    if (!step.field?.trim()) {
      errors.push(`Step "${step.id}" (${step.kind}) sem field.`);
    }
  }

  if (step.kind === "complete") {
    if (!step.complete) {
      errors.push(`Step "${step.id}" (${step.kind}) exige bloco complete.`);
    }
  }
}

export function validatePlaybookFlowDefinition(
  candidate: unknown
): ValidatePlaybookFlowResult {
  const errors: string[] = [];

  if (!isRecord(candidate)) {
    return { ok: false, errors: ["Definição de fluxo inválida: payload não é objeto JSON."] };
  }

  const schema =
    candidate[PLAYBOOK_FLOW_SCHEMA_KEY] ?? candidate[PLAYBOOK_FLOW_SCHEMA_KEY_LEGACY];
  if (schema !== PLAYBOOK_FLOW_SCHEMA_VERSION) {
    errors.push(
      `Schema inválido: esperado ${PLAYBOOK_FLOW_SCHEMA_KEY}=${PLAYBOOK_FLOW_SCHEMA_VERSION}.`
    );
  }

  const entryStepId = candidate.entry_step_id;
  if (typeof entryStepId !== "string" || !entryStepId.trim()) {
    errors.push(`Campo obrigatório inválido: "entry_step_id".`);
  }

  const stepsRaw = candidate.steps;
  if (!Array.isArray(stepsRaw) || stepsRaw.length === 0) {
    errors.push(`Campo obrigatório inválido: "steps" deve ser array com itens.`);
  }

  const steps = (Array.isArray(stepsRaw) ? stepsRaw : []) as PlaybookFlowStep[];
  const stepIds = new Set<string>();

  for (const step of steps) {
    if (!isRecord(step)) {
      errors.push("Item inválido em steps: cada step deve ser objeto.");
      continue;
    }
    const id = typeof step.id === "string" ? step.id.trim() : "";
    const kind = typeof step.kind === "string" ? step.kind : "";
    if (!id) {
      errors.push("Step com id vazio encontrado.");
      continue;
    }
    if (stepIds.has(id)) {
      errors.push(`Step id duplicado: "${id}".`);
    }
    stepIds.add(id);

    if (!["message", "menu", "input", "complete"].includes(kind)) {
      errors.push(`Step "${id}" possui kind inválido: "${kind}".`);
      continue;
    }
    validateStepInternalSemantics(step as PlaybookFlowStep, errors);
  }

  if (typeof entryStepId === "string" && entryStepId.trim() && !stepIds.has(entryStepId.trim())) {
    errors.push(`entry_step_id "${entryStepId}" não existe em steps.`);
  }

  for (const step of steps) {
    if (!isRecord(step) || typeof step.id !== "string" || !step.id.trim()) continue;
    const from = step.id.trim();
    const targets = collectNextTargets(step as PlaybookFlowStep);
    for (const target of targets) {
      if (!stepIds.has(target)) {
        errors.push(`Step "${from}" aponta para destino inexistente: "${target}".`);
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, definition: candidate as PlaybookFlowDefinition };
}
