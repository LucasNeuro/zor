import { describe, expect, it } from "vitest";
import { variantesNumberUazapi } from "@/lib/whatsapp/uazapi-send";

describe("variantesNumberUazapi", () => {
  it("prioriza dígitos quando entrada é JID @s.whatsapp.net", () => {
    const v = variantesNumberUazapi("5524992082725@s.whatsapp.net");
    expect(v[0]).toBe("5524992082725@s.whatsapp.net");
    expect(v).toContain("5524992082725");
  });

  it("inclui dígitos e JID para número puro", () => {
    const v = variantesNumberUazapi("5511970364501");
    expect(v).toContain("5511970364501");
    expect(v).toContain("5511970364501@s.whatsapp.net");
  });

  it("corrige 55 duplicado nas variantes", () => {
    const v = variantesNumberUazapi("555584550064");
    expect(v).toContain("5584550064");
  });
});
