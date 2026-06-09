/** Identificadores do bloco JSON de fluxo dinâmico no playbook (WhatsApp). */

export const PLAYBOOK_FLOW_SCHEMA_VERSION = 1 as const;

/** Fence preferido em markdown novo (Waje). */
export const PLAYBOOK_FLOW_FENCE_TAG = "waje_playbook_flow" as const;

/** Fence legado Obra10 — leitura mantida por compatibilidade. */
export const PLAYBOOK_FLOW_FENCE_TAG_LEGACY = "obra10_playbook_flow" as const;

export const PLAYBOOK_FLOW_FENCE_TAGS = [
  PLAYBOOK_FLOW_FENCE_TAG,
  PLAYBOOK_FLOW_FENCE_TAG_LEGACY,
] as const;

export const PLAYBOOK_FLOW_SCHEMA_KEY = "waje_playbook_flow_schema" as const;
export const PLAYBOOK_FLOW_SCHEMA_KEY_LEGACY = "obra10_playbook_flow_schema" as const;

export function playbookFlowFenceInfo(): string {
  return `json ${PLAYBOOK_FLOW_FENCE_TAG}`;
}

export function hasPlaybookFlowSchemaMarker(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return (
    Object.prototype.hasOwnProperty.call(value, PLAYBOOK_FLOW_SCHEMA_KEY) ||
    Object.prototype.hasOwnProperty.call(value, PLAYBOOK_FLOW_SCHEMA_KEY_LEGACY)
  );
}

export function isPlaybookFlowFenceTag(info: string): boolean {
  const normalized = info.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return false;
  return PLAYBOOK_FLOW_FENCE_TAGS.some(
    (tag) => normalized === tag || normalized === `json ${tag}` || normalized.includes(tag)
  );
}

/** Normaliza definição lida (legado ou Waje) para chave canónica Waje. */
export function normalizePlaybookFlowDefinition<T extends Record<string, unknown>>(raw: T): T & {
  waje_playbook_flow_schema: typeof PLAYBOOK_FLOW_SCHEMA_VERSION;
} {
  const schema =
    raw[PLAYBOOK_FLOW_SCHEMA_KEY] ?? raw[PLAYBOOK_FLOW_SCHEMA_KEY_LEGACY] ?? PLAYBOOK_FLOW_SCHEMA_VERSION;
  const { [PLAYBOOK_FLOW_SCHEMA_KEY_LEGACY]: _legacy, ...rest } = raw;
  return {
    ...rest,
    [PLAYBOOK_FLOW_SCHEMA_KEY]: schema as typeof PLAYBOOK_FLOW_SCHEMA_VERSION,
  } as T & { waje_playbook_flow_schema: typeof PLAYBOOK_FLOW_SCHEMA_VERSION };
}
