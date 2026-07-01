import { describe, expect, it } from "vitest";
import {
  HARNESS_DISPLAY_INITIAL,
  harnessDisplayReducer,
  pendingToHarnessEvents,
} from "@/lib/harness/display-state";

describe("harness display-state", () => {
  it("inicia streaming no turn_start", () => {
    const s = harnessDisplayReducer(HARNESS_DISPLAY_INITIAL, { type: "turn_start" });
    expect(s.isStreaming).toBe(true);
  });

  it("acumula tokens no turn_end", () => {
    let s = harnessDisplayReducer(HARNESS_DISPLAY_INITIAL, { type: "turn_start" });
    s = harnessDisplayReducer(s, { type: "turn_end", tokensInput: 100, tokensOutput: 50 });
    expect(s.isStreaming).toBe(false);
    expect(s.tokenUsage.input).toBe(100);
    expect(s.tokenUsage.output).toBe(50);
  });

  it("gerencia fila de aprovações", () => {
    const events = pendingToHarnessEvents([
      { id: "a1", resumo_humano: "Gravar lead", tool_name: "hub_operacao_empresa" },
    ]);
    let s = HARNESS_DISPLAY_INITIAL;
    for (const ev of events) s = harnessDisplayReducer(s, ev);
    expect(s.pendingApprovals).toHaveLength(1);
    s = harnessDisplayReducer(s, { type: "approval_resolved", approvalId: "a1", decisao: "aprovar" });
    expect(s.pendingApprovals).toHaveLength(0);
  });
});
