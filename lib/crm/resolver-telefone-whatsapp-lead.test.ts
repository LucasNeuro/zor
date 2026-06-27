import { describe, expect, it } from "vitest";
import {
  corrigirTelefoneWhatsappDuplicado,
  resolverDestinoWhatsappLead,
  resolverTelefoneWhatsappLead,
} from "@/lib/crm/resolver-telefone-whatsapp-lead";

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

  it("corrige prefixo 55 duplicado", () => {
    expect(
      resolverTelefoneWhatsappLead({
        telefone: "555584550064",
      })
    ).toBe("5584550064");
  });
});

describe("resolverDestinoWhatsappLead", () => {
  it("prefere wa_chatid", () => {
    expect(
      resolverDestinoWhatsappLead({
        telefone: "5511985579097",
        metadata: { wa_chatid: "5511941248613@s.whatsapp.net" },
      })
    ).toBe("5511941248613@s.whatsapp.net");
  });

  it("formata dígitos com @s.whatsapp.net", () => {
    expect(resolverDestinoWhatsappLead({ telefone: "5511985579097" })).toBe("5511985579097");
  });

  it("sem wa_chatid usa dígitos como a IA", () => {
    expect(resolverDestinoWhatsappLead({ telefone: "5524992082725" })).toBe("5524992082725");
  });
});

describe("corrigirTelefoneWhatsappDuplicado", () => {
  it("remove 55 extra no início", () => {
    expect(corrigirTelefoneWhatsappDuplicado("555584550064")).toBe("5584550064");
  });
});
