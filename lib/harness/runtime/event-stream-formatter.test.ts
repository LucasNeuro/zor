import { describe, expect, it } from "vitest";
import {
  buildInjectMessages,
  formatarEventStreamParaMistral,
  historicoParaEventStream,
} from "@/lib/harness/runtime/event-stream-formatter";

describe("event-stream-formatter", () => {
  it("prefixa mensagens user com [Message]", () => {
    const msgs = formatarEventStreamParaMistral([
      { type: "Message", role: "user", content: "Liste os leads" },
    ]);
    expect(msgs[0]).toEqual({ role: "user", content: "[Message]\nListe os leads" });
  });

  it("formata Plan e Knowledge como user inline", () => {
    const msgs = formatarEventStreamParaMistral([
      { type: "Plan", steps: ["Consultar leads", "Resumir"] },
      { type: "Knowledge", skill_id: "crm_pipeline", resumo: "Runbook pipeline" },
    ]);
    expect(msgs[0].content).toMatch(/^\[Plan\]/);
    expect(msgs[0].content).toMatch(/1\. Consultar leads/);
    expect(msgs[1].content).toMatch(/^\[Knowledge: crm_pipeline\]/);
  });

  it("buildInjectMessages cria Plan e Knowledge injectáveis", () => {
    const inj = buildInjectMessages({
      planSteps: ["Passo 1", "Passo 2"],
      knowledgeEvents: [{ skill_id: "crm_leads", resumo: "Como listar leads" }],
    });
    expect(inj).toHaveLength(2);
    expect(inj[0].content).toMatch(/\[Knowledge: crm_leads\]/);
    expect(inj[1].content).toMatch(/\[Plan\]/);
  });

  it("historicoParaEventStream preserva ordem", () => {
    const eventos = historicoParaEventStream([
      { role: "user", content: "Olá" },
      { role: "assistant", content: "Oi" },
    ]);
    expect(eventos).toHaveLength(2);
    expect(eventos[0].type).toBe("Message");
    expect(eventos[0].role).toBe("user");
  });
});
