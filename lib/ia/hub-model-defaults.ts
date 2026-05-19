/**
 * Defaults Hub / CRM — Mistral-first: valores guardados podem ser o sentinel `mistral`
 * (usa `MISTRAL_MODEL` em runtime) ou IDs explícitos (Claude, Mistral, etc.).
 */

export const HUB_MODELO_SENTINEL = "mistral";

/** Defaults antigos vindos do catálogo/API — convertidos para sentinel/env ao criar agente. */
const LEGACY_PADRAO = "claude-haiku-4-5-20251001";
const LEGACY_CRITICO = "claude-sonnet-4-6";
const LEGACY_ALTO_VALOR = "claude-opus-4-7";

export function mistralDefaultModelId(): string {
  return process.env.MISTRAL_MODEL?.trim() || "mistral-small-latest";
}

/** Modelo barato para memória, resumo e tarefas auxiliares. */
export function mistralMemoryModelId(): string {
  return process.env.MISTRAL_MEMORY_MODEL?.trim() || "mistral-small-latest";
}

/**
 * Modelo para Mistral Agents API — só aceita família Mistral.
 * IDs Anthropic/legados são mapeados para MISTRAL_MODEL / mistral-small-latest.
 */
export function resolveMistralAgentsModelId(stored?: string | null): string {
  const resolved = resolveInferenceModelId(stored);
  if (isMistralFamilyModelId(resolved)) return resolved;
  return mistralDefaultModelId();
}

/** Modelo efectivo para chamadas à API (expande sentinel → env). */
export function resolveInferenceModelId(stored?: string | null): string {
  const raw = (stored ?? "").trim();
  if (!raw || raw === HUB_MODELO_SENTINEL || raw.toLowerCase() === "mistral") {
    return mistralDefaultModelId();
  }
  return raw;
}

export function isMistralFamilyModelId(modelId: string): boolean {
  const m = modelId.toLowerCase();
  return (
    m === HUB_MODELO_SENTINEL ||
    m.startsWith("mistral-") ||
    m.startsWith("ministral") ||
    m.startsWith("open-mixtral") ||
    m.startsWith("pixtral") ||
    m.startsWith("codestral")
  );
}

export function isAnthropicModelId(modelId: string): boolean {
  return modelId.toLowerCase().startsWith("claude-");
}

/**
 * Valida valores aceites em hub_agente_identidade (constraint chk_modelo_valido;
 * ver migração 20260602120000_hub_agente_identidade_chk_modelo_valido.sql).
 */
export function isHubModeloIdDbCompatible(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  const lower = t.toLowerCase();
  if (lower === HUB_MODELO_SENTINEL) return true;
  if (["haiku", "sonnet", "opus"].includes(lower)) return true;
  if (isMistralFamilyModelId(t)) return true;
  if (isAnthropicModelId(t)) return true;
  return false;
}

/**
 * Aceita valores vindos do PostgREST/JSON onde `modelo_*` pode ser texto, número, booleano, etc.
 * (evitar `unknown?.trim()` que devolve undefined e faz o normalizador cair só no legado equivocado.)
 */
export function coerceModeloStoredText(raw: unknown): string {
  if (raw == null) return "";
  const t = typeof raw === "string" ? raw.trim() : String(raw).trim();
  return t;
}

/** Postgres `chk_modelo_valido` — mensagens 23514 no insert/update. */
export function isChkModeloValidoConstraintMessage(message?: string | null): boolean {
  const m = (message ?? "").toLowerCase();
  return m.includes("chk_modelo_valido") || m.includes("hub_agente_modelo_id_valido");
}

/** Valor canónico para INSERT/UPDATE: nunca deixa passar um ID que o Postgres rejeita. */
function normalizeModeloColumnForHubInsert(raw: unknown, legacyFullId: string): string {
  let t = coerceModeloStoredText(raw);
  if (!t || t === legacyFullId) t = HUB_MODELO_SENTINEL;
  else if (t.toLowerCase() === "mistral") t = HUB_MODELO_SENTINEL;
  else if (["haiku", "sonnet", "opus"].includes(t.toLowerCase())) t = HUB_MODELO_SENTINEL;
  if (!isHubModeloIdDbCompatible(t)) t = HUB_MODELO_SENTINEL;
  return t;
}

/** Três colunas obrigatórias em `hub_agente_identidade` (chk_modelo_valido em todas). */
export function modeloColumnsForAgenteIdentidadeInsert(row: Record<string, unknown>): {
  modelo_padrao: string;
  modelo_critico: string;
  modelo_alto_valor: string;
} {
  return {
    modelo_padrao: modeloPadraoForHubInsert(row.modelo_padrao),
    modelo_critico: modeloCriticoForHubInsert(row.modelo_critico),
    modelo_alto_valor: modeloAltoValorForHubInsert(row.modelo_alto_valor),
  };
}

/** Última linha de defesa antes do INSERT quando o catálogo tem formatos estranhos não previstos. */
export function forceMistralModeloTripleForDb(): {
  modelo_padrao: string;
  modelo_critico: string;
  modelo_alto_valor: string;
} {
  return {
    modelo_padrao: HUB_MODELO_SENTINEL,
    modelo_critico: HUB_MODELO_SENTINEL,
    modelo_alto_valor: HUB_MODELO_SENTINEL,
  };
}

export function modeloPadraoForHubInsert(raw?: unknown): string {
  return normalizeModeloColumnForHubInsert(raw, LEGACY_PADRAO);
}

export function modeloCriticoForHubInsert(raw?: unknown): string {
  return normalizeModeloColumnForHubInsert(raw, LEGACY_CRITICO);
}

export function modeloAltoValorForHubInsert(raw?: unknown): string {
  return normalizeModeloColumnForHubInsert(raw, LEGACY_ALTO_VALOR);
}

/** Texto fixo nos ecrãs do CRM: o modelo efectivo vem do Agno / `MISTRAL_MODEL`, não por agente. */
export const INFERENCIA_IA_CRM_COPIA =
  "Mistral (Agno). Modelo efectivo: MISTRAL_MODEL no servidor — não define aqui.";

/** Rótulo curto para CRM/wizard (sem expor segredos). */
export function hubModeloUiLabel(stored?: string | null): string {
  const t = (stored ?? "").trim();
  if (!t) return "—";
  if (t === HUB_MODELO_SENTINEL || t.toLowerCase() === "mistral") return "Mistral (MISTRAL_MODEL no servidor)";
  return t;
}
