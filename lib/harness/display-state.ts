/**
 * displayState — reducer de eventos harness para UI (RFC §9.4).
 */
export type HarnessEvent =
  | { type: "turn_start"; modoId?: string }
  | { type: "turn_end"; tokensInput?: number; tokensOutput?: number }
  | { type: "tool_start"; toolName: string }
  | { type: "tool_end"; toolName: string; ok?: boolean }
  | { type: "approval_required"; approvalId: string; resumo: string; toolName?: string }
  | { type: "approval_resolved"; approvalId: string; decisao: "aprovar" | "rejeitar" }
  | { type: "mode_changed"; modoId: string }
  | { type: "error"; message: string };

export type HarnessDisplayState = {
  isStreaming: boolean;
  activeTools: string[];
  pendingApprovals: Array<{ id: string; resumo: string; toolName?: string }>;
  modeId: string;
  tokenUsage: { input: number; output: number };
  lastError: string | null;
};

export const HARNESS_DISPLAY_INITIAL: HarnessDisplayState = {
  isStreaming: false,
  activeTools: [],
  pendingApprovals: [],
  modeId: "analisar",
  tokenUsage: { input: 0, output: 0 },
  lastError: null,
};

export function harnessDisplayReducer(
  state: HarnessDisplayState,
  event: HarnessEvent
): HarnessDisplayState {
  switch (event.type) {
    case "turn_start":
      return {
        ...state,
        isStreaming: true,
        lastError: null,
        modeId: event.modoId ?? state.modeId,
      };
    case "turn_end":
      return {
        ...state,
        isStreaming: false,
        tokenUsage: {
          input: state.tokenUsage.input + (event.tokensInput ?? 0),
          output: state.tokenUsage.output + (event.tokensOutput ?? 0),
        },
      };
    case "tool_start":
      return {
        ...state,
        activeTools: [...state.activeTools, event.toolName],
      };
    case "tool_end":
      return {
        ...state,
        activeTools: state.activeTools.filter((t) => t !== event.toolName),
      };
    case "approval_required":
      return {
        ...state,
        pendingApprovals: [
          ...state.pendingApprovals.filter((p) => p.id !== event.approvalId),
          { id: event.approvalId, resumo: event.resumo, toolName: event.toolName },
        ],
      };
    case "approval_resolved":
      return {
        ...state,
        pendingApprovals: state.pendingApprovals.filter((p) => p.id !== event.approvalId),
      };
    case "mode_changed":
      return { ...state, modeId: event.modoId };
    case "error":
      return { ...state, isStreaming: false, lastError: event.message };
    default:
      return state;
  }
}

export function pendingToHarnessEvents(
  pending: Array<{ id: string; resumo_humano?: string; tool_name?: string }>
): HarnessEvent[] {
  return pending.map((p) => ({
    type: "approval_required" as const,
    approvalId: p.id,
    resumo: p.resumo_humano ?? p.tool_name ?? "Alteração pendente",
    toolName: p.tool_name,
  }));
}
