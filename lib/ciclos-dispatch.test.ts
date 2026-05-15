import { describe, it, expect } from "vitest";
import { cronMatchesUtc, inferDispatchFromCicloRow, isProgramadoCicloDue } from "./ciclos-dispatch";

describe("cronMatchesUtc", () => {
  it("matches daily at 07:00 UTC", () => {
    const d = new Date(Date.UTC(2026, 4, 14, 7, 0, 0));
    expect(cronMatchesUtc(d, "0 7 * * *")).toBe(true);
    expect(cronMatchesUtc(d, "0 8 * * *")).toBe(false);
  });

  it("matches */30 minute cadence", () => {
    const a = new Date(Date.UTC(2026, 4, 14, 10, 30, 0));
    expect(cronMatchesUtc(a, "*/30 * * * *")).toBe(true);
    const b = new Date(Date.UTC(2026, 4, 14, 10, 22, 0));
    expect(cronMatchesUtc(b, "*/30 * * * *")).toBe(false);
  });
});

describe("isProgramadoCicloDue", () => {
  const baseRow = {
    id: "1",
    agente_slug: "diretor_geral_ia",
    nome: "X",
    tipo: "programado",
    ativo: true,
    cron_expressao: "0 7 * * *",
    intervalo_minutos: null,
    ultimo_ciclo: null,
    configuracoes: {},
  };

  it("due when cron matches and never ran", () => {
    const now = new Date(Date.UTC(2026, 4, 14, 7, 0, 5));
    expect(isProgramadoCicloDue(baseRow, now)).toBe(true);
  });

  it("not due twice same UTC minute", () => {
    const now = new Date(Date.UTC(2026, 4, 14, 7, 0, 5));
    const row = {
      ...baseRow,
      ultimo_ciclo: new Date(Date.UTC(2026, 4, 14, 7, 0, 10)).toISOString(),
    };
    expect(isProgramadoCicloDue(row, now)).toBe(false);
  });

  it("interval-only due after window", () => {
    const past = new Date(Date.now() - 40 * 60_000).toISOString();
    const row = {
      ...baseRow,
      cron_expressao: "",
      intervalo_minutos: 30,
      ultimo_ciclo: past,
    };
    expect(isProgramadoCicloDue(row, new Date())).toBe(true);
  });
});

describe("inferDispatchFromCicloRow", () => {
  it("uses configuracoes.dispatch for new agents", () => {
    const r = inferDispatchFromCicloRow({
      agente_slug: "qualificador",
      nome: "Qualificador — Follow custom",
      configuracoes: { dispatch: { api: "atendente", ciclo: "followup" } },
    });
    expect(r).toEqual({ api: "atendente", ciclo: "followup" });
  });

  it("infers diretor analise_manha", () => {
    const r = inferDispatchFromCicloRow({
      agente_slug: "diretor_geral_ia",
      nome: "Diretor — Análise Matinal",
      configuracoes: {},
    });
    expect(r).toEqual({ api: "diretor", ciclo: "analise_manha" });
  });
});
