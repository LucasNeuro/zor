import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resolveRequestPublicOrigin } from "@/lib/platform-brands";

describe("resolveRequestPublicOrigin", () => {
  const prevEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...prevEnv };
  });

  it("em produção usa x-forwarded-host (Render) em vez de localhost interno", () => {
    vi.stubEnv("NODE_ENV", "production");

    const req = new NextRequest("http://127.0.0.1:10000/api/hub/integradores/oauth/google/start", {
      headers: {
        "x-forwarded-host": "synkronia.com.br",
        "x-forwarded-proto": "https",
      },
    });

    expect(resolveRequestPublicOrigin(req)).toBe("https://synkronia.com.br");
  });

  it("em desenvolvimento usa nextUrl.origin", () => {
    vi.stubEnv("NODE_ENV", "development");

    const req = new NextRequest("http://localhost:3001/crm/agentes/lucca");
    expect(resolveRequestPublicOrigin(req)).toBe("http://localhost:3001");
  });
});
