import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { cronRequestAuthorized } from "./cron-auth";

describe("cronRequestAuthorized", () => {
  const prevEnv = { ...process.env };

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    process.env.CRON_SECRET = "test_secret_xyz";
  });

  afterEach(() => {
    process.env.NODE_ENV = prevEnv.NODE_ENV;
    process.env.CRON_SECRET = prevEnv.CRON_SECRET;
  });

  it("allows query secret in production", () => {
    const req = new NextRequest("http://x/api/ciclos/diretor?secret=test_secret_xyz");
    expect(cronRequestAuthorized(req)).toBe(true);
  });

  it("allows x-cron-secret header", () => {
    const req = new NextRequest("http://x/api/ciclos/diretor", {
      headers: { "x-cron-secret": "test_secret_xyz" },
    });
    expect(cronRequestAuthorized(req)).toBe(true);
  });

  it("allows Bearer CRON_SECRET", () => {
    const req = new NextRequest("http://x/api/ciclos/diretor", {
      headers: { authorization: "Bearer test_secret_xyz" },
    });
    expect(cronRequestAuthorized(req)).toBe(true);
  });

  it("allows x-vercel-cron", () => {
    const req = new NextRequest("http://x/api/ciclos/diretor", {
      headers: { "x-vercel-cron": "1" },
    });
    expect(cronRequestAuthorized(req)).toBe(true);
  });

  it("rejects wrong secret", () => {
    const req = new NextRequest("http://x/api/ciclos/diretor?secret=wrong");
    expect(cronRequestAuthorized(req)).toBe(false);
  });

  it("rejects manual calls when CRON_SECRET is missing in production", () => {
    delete process.env.CRON_SECRET;
    const req = new NextRequest("http://x/api/ciclos/diretor?secret=obra10plus_cron_2026");
    expect(cronRequestAuthorized(req)).toBe(false);
  });
});
