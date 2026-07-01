import type { HarnessOutcomeClassification } from "@/lib/harness/types";

export type ClassifyOutcomeInput = {
  texto?: string | null;
  reasoningText?: string | null;
  promptError?: unknown;
};

export function classifyHarnessOutcome(input: ClassifyOutcomeInput): HarnessOutcomeClassification {
  if (input.promptError !== undefined && input.promptError !== null) {
    return "error";
  }
  const texto = (input.texto ?? "").trim();
  if (texto) return "assistant_text";
  if ((input.reasoningText ?? "").trim()) return "reasoning_only";
  return "empty";
}
