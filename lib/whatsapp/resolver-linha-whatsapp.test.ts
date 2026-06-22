import { describe, expect, it } from "vitest";
import { validarAgenteWaRowForWebhook } from "./resolver-linha-whatsapp";

describe("validarAgenteWaRowForWebhook", () => {
  const base = {
    agente_slug: "dhe",
    modo_operacao: "canal_whatsapp",
    uazapi_instance_token: "tok-abc",
    uazapi_connection_status: "connected",
    tenant_id: "b6556af6-acc5-4d07-8c48-2609734e43b2",
    ativo: true,
    arquivado_em: null,
  };

  it("aceita agente conectado independente do tenant", () => {
    const r = validarAgenteWaRowForWebhook(base);
    expect(r).toEqual({
      kind: "agent_instance",
      agenteSlug: "dhe",
      instanceToken: "tok-abc",
      tenantId: "b6556af6-acc5-4d07-8c48-2609734e43b2",
    });
  });

  it("aceita status connecting", () => {
    const r = validarAgenteWaRowForWebhook({ ...base, uazapi_connection_status: "connecting" });
    expect(r?.kind).toBe("agent_instance");
  });

  it("rejeita disconnected", () => {
    const r = validarAgenteWaRowForWebhook({ ...base, uazapi_connection_status: "disconnected" });
    expect(r).toEqual({ kind: "ignored", reason: "whatsapp_nao_conectado" });
  });
});
