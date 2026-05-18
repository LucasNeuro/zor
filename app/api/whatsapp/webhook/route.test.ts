import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "crypto";
import { GET, POST, webhookAutenticado } from "./route";

describe("webhookAutenticado", () => {
  const secret = "test-secret-key";

  it("rejects when signature header present but HMAC hex does not match body", () => {
    const body = '{"event":"messages.upsert"}';
    const req = new NextRequest("http://localhost/api/whatsapp/webhook", {
      method: "POST",
      headers: { "x-hub-signature-256": "deadbeef" },
      body,
    });
    expect(webhookAutenticado(req, body, secret)).toBe(false);
  });

  it("accepts valid x-hub-signature-256 (sha256= prefix)", () => {
    const body = '{"event":"noop"}';
    const digest = createHmac("sha256", secret).update(body).digest("hex");
    const req = new NextRequest("http://localhost/api/whatsapp/webhook", {
      method: "POST",
      headers: { "x-hub-signature-256": `sha256=${digest}` },
      body,
    });
    expect(webhookAutenticado(req, body, secret)).toBe(true);
  });

  it("accepts secret in query param (UAZAPI webhook URL sync)", () => {
    const body = "{}";
    const req = new NextRequest(`http://localhost/api/whatsapp/webhook?wh=${encodeURIComponent(secret)}`, {
      method: "POST",
      body,
    });
    expect(webhookAutenticado(req, body, secret)).toBe(true);
  });
});

describe("WhatsApp webhook route", () => {
  const prevEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.WEBHOOK_SECRET = "integration-secret";
    delete process.env.WEBHOOK_SKIP_SIGNATURE_VERIFY;
    process.env.WHATSAPP_VERIFY_TOKEN = "verify-me";
    // POST success path não é coberto aqui — só garantir que ENV existe se algum código carregar antes
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY || "service-role-placeholder";
  });

  afterEach(() => {
    process.env.WEBHOOK_SECRET = prevEnv.WEBHOOK_SECRET;
    process.env.WEBHOOK_SKIP_SIGNATURE_VERIFY = prevEnv.WEBHOOK_SKIP_SIGNATURE_VERIFY;
    process.env.WHATSAPP_VERIFY_TOKEN = prevEnv.WHATSAPP_VERIFY_TOKEN;
    process.env.NEXT_PUBLIC_SUPABASE_URL = prevEnv.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = prevEnv.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("GET Meta subscription verification returns hub.challenge when token matches", async () => {
    const req = new NextRequest(
      "http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345abc"
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("12345abc");
  });

  it("POST rejects with JSON when WEBHOOK_SECRET is set and signature is absent/invalid", async () => {
    const body = JSON.stringify({ event: "messages.upsert", data: {} });
    const req = new NextRequest("http://localhost/api/whatsapp/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error?: string; code?: string };
    expect(json.error).toBeDefined();
    expect(json.code).toBe("WEBHOOK_AUTH_FAILED");
  });
});
