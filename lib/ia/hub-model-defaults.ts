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

export function modeloPadraoForHubInsert(raw?: string | null): string {
  const t = raw?.trim();
  if (!t || t === LEGACY_PADRAO) return HUB_MODELO_SENTINEL;
  return t;
}

export function modeloCriticoForHubInsert(raw?: string | null): string {
  const t = raw?.trim();
  if (!t || t === LEGACY_CRITICO) return HUB_MODELO_SENTINEL;
  return t;
}

export function modeloAltoValorForHubInsert(raw?: string | null): string {
  const t = raw?.trim();
  if (!t || t === LEGACY_ALTO_VALOR) return HUB_MODELO_SENTINEL;
  return t;
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
