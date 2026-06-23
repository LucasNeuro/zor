import { describe, expect, it, vi, beforeEach } from "vitest";

const mockLinha = vi.fn();

vi.mock("@/lib/whatsapp/resolver-linha-whatsapp", () => ({
  WA_LIVE_STATUSES: new Set(["connected", "connecting", "open", "online"]),
  resolverLinhaWhatsAppInbound: (...args: unknown[]) => mockLinha(...args),
}));

import { resolverTokenInstanciaWhatsapp } from "@/lib/crm/resolver-token-whatsapp";

function supabaseWithAgente(row: Record<string, unknown> | null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row, error: null }),
        }),
      }),
    }),
  };
}

describe("resolverTokenInstanciaWhatsapp", () => {
  beforeEach(() => {
    mockLinha.mockReset();
    delete process.env.UAZAPI_INSTANCE_TOKEN;
  });

  it("usa token do agente quando status é open", async () => {
    const sb = supabaseWithAgente({
      uazapi_instance_token: "tok-ana",
      uazapi_connection_status: "open",
      ativo: true,
      arquivado_em: null,
    });
    const r = await resolverTokenInstanciaWhatsapp(sb as never, "ana");
    expect(r.token).toBe("tok-ana");
    expect(r.origem).toBe("agente:ana");
    expect(mockLinha).not.toHaveBeenCalled();
  });

  it("não faz fallback quando agente tem token mas está disconnected", async () => {
    const sb = supabaseWithAgente({
      uazapi_instance_token: "tok-ana",
      uazapi_connection_status: "disconnected",
      ativo: true,
      arquivado_em: null,
    });
    const r = await resolverTokenInstanciaWhatsapp(sb as never, "ana");
    expect(r.token).toBeNull();
    expect(r.origem).toContain("desconectado");
    expect(mockLinha).not.toHaveBeenCalled();
  });
});
