import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aggregateDashboard, fetchCrmMetricas } from "@/lib/crm/dashboard-aggregate";

type EqCall = { column: string; value: unknown };

function createRecordingSupabase(responses: Record<string, unknown> = {}) {
  const eqCalls: EqCall[] = [];

  function defaultPayload(table: string) {
    if (table === "hub_agente_identidade") {
      return { data: [{ agente_slug: "agente-a" }], error: null };
    }
    if (table === "hub_leads_crm") {
      return { data: [{ estagio: "novo", valor_estimado: 100 }], count: 1, error: null };
    }
    return { data: [], count: 0, error: null };
  }

  function chain(table: string) {
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (column: string, value: unknown) => {
        eqCalls.push({ column, value });
        return builder;
      },
      in: (column: string, value: unknown) => {
        eqCalls.push({ column, value });
        return builder;
      },
      gte: () => builder,
      order: () => builder,
      limit: () => builder,
      then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        const payload = responses[table] ?? defaultPayload(table);
        return Promise.resolve(payload).then(onFulfilled, onRejected);
      },
    };
    return builder;
  }

  const supabase = {
    from: (table: string) => chain(table),
  } as unknown as SupabaseClient;

  return { supabase, eqCalls };
}

describe("dashboard-aggregate tenant filters", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("fetchCrmMetricas aplica tenant_id nas tabelas multi-tenant", async () => {
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const { supabase, eqCalls } = createRecordingSupabase();

    await fetchCrmMetricas(supabase, tenantId);

    const tenantFilters = eqCalls.filter((c) => c.column === "tenant_id" && c.value === tenantId);
    expect(tenantFilters.length).toBeGreaterThanOrEqual(5);
  });

  it("aggregateDashboard filtra ciclos_ia e alertas por tenant", async () => {
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const { supabase, eqCalls } = createRecordingSupabase();

    await aggregateDashboard(supabase, tenantId);

    expect(eqCalls.some((c) => c.column === "tenant_id" && c.value === tenantId)).toBe(true);
    expect(
      eqCalls.some(
        (c) =>
          c.column === "agente_slug" &&
          (c.value === "agente-a" || (Array.isArray(c.value) && c.value.includes("agente-a")))
      )
    ).toBe(true);
  });
});
