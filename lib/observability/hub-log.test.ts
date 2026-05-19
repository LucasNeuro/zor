import { describe, it, expect, vi, afterEach } from "vitest";
import { createHubLogger, maskTelefone } from "./hub-log";

describe("hub-log", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maskTelefone mantém só últimos 4 dígitos", () => {
    expect(maskTelefone("5511914589862")).toBe("***9862");
  });

  it("emite JSON com event e traceId", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const log = createHubLogger("test_scope", {}, "trace-abc");
    log.info("test.event", { foo: 1 });

    expect(spy).toHaveBeenCalledOnce();
    const line = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line) as { event: string; traceId: string; scope: string; foo: number };
    expect(parsed.event).toBe("test.event");
    expect(parsed.traceId).toBe("trace-abc");
    expect(parsed.scope).toBe("test_scope");
    expect(parsed.foo).toBe(1);
  });
});
