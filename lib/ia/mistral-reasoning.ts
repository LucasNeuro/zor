/** Mistral adjustable reasoning (`reasoning_effort`) e parsing de chunks `thinking` / `text`. */

export type MistralReasoningEffort = "none" | "high";

function parseBoolEnv(raw: string | undefined): boolean {
  const v = String(raw ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

/** Valor global de `MISTRAL_REASONING_EFFORT` (default `none` para latência). */
export function mistralReasoningEffortFromEnv(): MistralReasoningEffort {
  const raw = process.env.MISTRAL_REASONING_EFFORT?.trim().toLowerCase();
  return raw === "high" ? "high" : "none";
}

/**
 * Resolve se deve enviar `reasoning_effort` à API.
 * - Toggle do agente (`hub_raciocinio_avancado`) força `high` quando activo.
 * - Com `MISTRAL_REASONING_EFFORT_PLAYBOOK_IA_ONLY=1`, só aplica em turnos `playbook_ia`
 *   (tanto env global como toggle por agente).
 */
export function resolveMistralReasoningEffort(opts?: {
  playbookIaTurn?: boolean;
  agentReasoningEnabled?: boolean;
}): MistralReasoningEffort {
  const playbookOnly = parseBoolEnv(process.env.MISTRAL_REASONING_EFFORT_PLAYBOOK_IA_ONLY);
  const playbookTurnOk = !playbookOnly || opts?.playbookIaTurn === true;

  if (opts?.agentReasoningEnabled && playbookTurnOk) {
    return "high";
  }

  const effort = mistralReasoningEffortFromEnv();
  if (playbookOnly) {
    return opts?.playbookIaTurn ? effort : "none";
  }
  return effort;
}

/** Extrai apenas texto final da resposta Mistral (ignora chunks `thinking`). */
export function extrairTextoRespostaMistral(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (!Array.isArray(raw)) {
    if (raw != null && typeof raw === "object") {
      const o = raw as Record<string, unknown>;
      if (o.type === "text" && typeof o.text === "string") return o.text;
    }
    return raw != null ? String(raw) : "";
  }

  const textParts: string[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const chunk = item as Record<string, unknown>;
    if (chunk.type === "text" && typeof chunk.text === "string") {
      textParts.push(chunk.text);
    }
    // `type: "thinking"` — raciocínio interno; não enviar ao WhatsApp.
  }
  return textParts.join("").trim();
}
