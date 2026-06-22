import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  isLocalhostHost,
  isWebhookUrlLocalhost,
  pickPublicAppOrigin,
  shouldSyncGlobalWebhookToOrigin,
} from "@/lib/whatsapp/uazapi-webhook-sync";

describe("pickPublicAppOrigin", () => {
  const prevEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...prevEnv };
  });

  it("em produção prioriza x-forwarded-host sobre NEXT_PUBLIC_APP_URL localhost", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3001");

    const req = new NextRequest("http://localhost:10000/api/hub/agentes/x/uazapi", {
      headers: {
        "x-forwarded-host": "waje.com.br",
        "x-forwarded-proto": "https",
      },
    });

    expect(pickPublicAppOrigin(req)).toBe("https://waje.com.br");
  });

  it("em desenvolvimento aceita localhost do env", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3001");

    const req = new NextRequest("http://localhost:3001/api/test");
    expect(pickPublicAppOrigin(req)).toBe("http://localhost:3001");
  });

  it("em produção rejeita localhost no env sem forwarded host", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3001");
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("RENDER_EXTERNAL_URL", "");

    const req = new NextRequest("http://127.0.0.1:10000/api/test");
    expect(pickPublicAppOrigin(req)).toBeNull();
  });
});

describe("isWebhookUrlLocalhost", () => {
  it("detecta localhost na URL do webhook", () => {
    expect(isWebhookUrlLocalhost("http://localhost:3001/api/whatsapp/webhook?wh=abc")).toBe(true);
    expect(isWebhookUrlLocalhost("https://waje.com.br/api/whatsapp/webhook?wh=abc")).toBe(false);
  });
});

describe("isLocalhostHost", () => {
  it("reconhece hosts locais", () => {
    expect(isLocalhostHost("localhost")).toBe(true);
    expect(isLocalhostHost("waje.com.br")).toBe(false);
  });
});

describe("shouldSyncGlobalWebhookToOrigin", () => {
  it("bloqueia global webhook em localhost por padrão", () => {
    expect(shouldSyncGlobalWebhookToOrigin("http://localhost:3001")).toBe(false);
    expect(shouldSyncGlobalWebhookToOrigin("https://waje.com.br")).toBe(true);
  });
});
