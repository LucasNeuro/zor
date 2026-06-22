import { describe, expect, it } from "vitest";
import { isWajePlatformCaller } from "@/lib/crm/resolve-tenant-from-caller";

describe("isWajePlatformCaller", () => {
  it("cliente com tenant_id não é plataforma", () => {
    expect(
      isWajePlatformCaller({
        role: "owner",
        owner: true,
        tenant_id: "b6556af6-acc5-4d07-8c48-2609734e43b2",
      }),
    ).toBe(false);
  });

  it("equipe Waje sem tenant é plataforma", () => {
    expect(
      isWajePlatformCaller({
        role: "platform_admin",
        owner: true,
        tenant_id: null,
      }),
    ).toBe(true);
  });

  it("utilizador tenant owner (role) sem flag plataforma", () => {
    expect(
      isWajePlatformCaller({
        role: "owner",
        owner: false,
        tenant_id: "b6556af6-acc5-4d07-8c48-2609734e43b2",
      }),
    ).toBe(false);
  });
});
