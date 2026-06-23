import { describe, expect, it } from "vitest";
import { resolverTelefoneWhatsappLead } from "@/lib/crm/resolver-telefone-whatsapp-lead";

describe("resolverTelefoneWhatsappLead", () => {
  it("prefere wa_telefone do metadata", () => {
    const tel = resolverTelefoneWhatsappLead({
      telefone: "5511985579097",
      metadata: { wa_telefone: "5511941248613" },
    });
    expect(tel).toBe("5511941248613");
  });

  it("usa coluna telefone se wa_telefone ausente", () => {
    expect(resolverTelefoneWhatsappLead({ telefone: "5511985579097" })).toBe("5511985579097");
  });
});
