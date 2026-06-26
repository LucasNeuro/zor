import { afterEach, describe, expect, it } from "vitest";
import {
  followupCronShouldRun,
  followupDispatchMode,
  followupWorkerShouldRun,
} from "@/lib/hub/followup-dispatch";

describe("followup dispatch mode", () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it("default é cron", () => {
    delete process.env.FOLLOWUP_DISPATCH_MODE;
    expect(followupDispatchMode()).toBe("cron");
    expect(followupCronShouldRun()).toBe(true);
  });

  it("modo worker desliga cron", () => {
    process.env.FOLLOWUP_DISPATCH_MODE = "worker";
    process.env.DISPATCH_FOLLOWUP_ENABLED = "1";
    expect(followupCronShouldRun()).toBe(false);
    process.env.FOLLOWUP_WORKER_ENABLED = "1";
    expect(followupWorkerShouldRun()).toBe(true);
  });

  it("modo cron desliga worker follow-up", () => {
    process.env.FOLLOWUP_DISPATCH_MODE = "cron";
    process.env.FOLLOWUP_WORKER_ENABLED = "1";
    expect(followupWorkerShouldRun()).toBe(false);
    expect(followupCronShouldRun()).toBe(true);
  });

  it("DISPATCH_FOLLOWUP_ENABLED=0 desliga cron", () => {
    process.env.FOLLOWUP_DISPATCH_MODE = "cron";
    process.env.DISPATCH_FOLLOWUP_ENABLED = "0";
    expect(followupCronShouldRun()).toBe(false);
  });
});
