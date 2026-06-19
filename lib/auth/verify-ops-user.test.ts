import { afterEach, describe, expect, it } from "vitest";
import { resolveWajePlatformOwner } from "@/lib/auth/verify-ops-user";

describe("resolveWajePlatformOwner", () => {
  afterEach(() => {
    delete process.env.WAJE_OPS_ALLOWED_EMAILS;
  });

  it("libera com users.owner = true", () => {
    expect(
      resolveWajePlatformOwner(
        { owner: true, role: "vendedor", email: "a@x.com", status: "Ativo" },
        "a@x.com",
      ),
    ).toBe(true);
  });

  it("não confunde role CRM owner com plataforma", () => {
    expect(
      resolveWajePlatformOwner(
        { owner: false, role: "owner", email: "tenant@x.com", status: "Ativo" },
        "tenant@x.com",
      ),
    ).toBe(false);
  });

  it("libera e-mail na allowlist WAJE_OPS_ALLOWED_EMAILS", () => {
    process.env.WAJE_OPS_ALLOWED_EMAILS = "ops@waje.com.br,lucas@test.com";
    expect(
      resolveWajePlatformOwner(
        { owner: false, role: "owner", email: "lucas@test.com", status: "Ativo" },
        "lucas@test.com",
      ),
    ).toBe(true);
  });

  it("libera role legado platform_admin", () => {
    expect(
      resolveWajePlatformOwner(
        { owner: false, role: "platform_admin", email: "x@y.com", status: "Ativo" },
        "x@y.com",
      ),
    ).toBe(true);
  });
});
