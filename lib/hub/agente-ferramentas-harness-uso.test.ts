import { describe, expect, it } from "vitest";
import {
  extrairUsoFerramentasHarnessIa,
  mergeUsoFerramentasComPadraoPreservandoCustom,
  mergeUsoFerramentasJobsInternos,
  usoTemChavesHarnessGuardadas,
} from "@/lib/hub/agente-ferramentas-registry";
import { toolsetsActivos } from "@/lib/harness/toolsets";

describe("extrairUsoFerramentasHarnessIa", () => {
  it("preserva chaves harness_* válidas", () => {
    const raw = {
      hub_metricas_escritorio: true,
      harness_skills_list: true,
      harness_skill_view: false,
      harness_foo: true,
    };
    expect(extrairUsoFerramentasHarnessIa(raw)).toEqual({
      harness_skills_list: true,
      harness_skill_view: false,
    });
  });
});

describe("mergeUsoFerramentasComPadraoPreservandoCustom + harness", () => {
  it("mantém harness_skills_list após merge", () => {
    const merged = mergeUsoFerramentasComPadraoPreservandoCustom({
      hub_metricas_escritorio: true,
      harness_skills_list: true,
      harness_delegate_to_agent: true,
    });
    expect(merged.harness_skills_list).toBe(true);
    expect(merged.harness_delegate_to_agent).toBe(true);
    expect(toolsetsActivos(merged).some((t) => t.id === "skills_harness")).toBe(true);
  });
});

describe("mergeUsoFerramentasJobsInternos legado", () => {
  it("activa skills_harness quando não há chaves harness guardadas", () => {
    const merged = mergeUsoFerramentasJobsInternos(
      { hub_metricas_escritorio: true },
      "jobs_internos"
    );
    expect(usoTemChavesHarnessGuardadas({ hub_metricas_escritorio: true })).toBe(false);
    expect(merged.harness_skills_list).toBe(true);
    expect(merged.harness_skill_view).toBe(true);
    expect(toolsetsActivos(merged).some((t) => t.id === "skills_harness")).toBe(true);
  });

  it("respeita desactivação explícita de skills harness", () => {
    const merged = mergeUsoFerramentasJobsInternos(
      {
        harness_skills_list: false,
        harness_skill_view: false,
        harness_skill_manage: false,
        harness_session_search: false,
        harness_delegate_to_agent: false,
      },
      "jobs_internos"
    );
    expect(toolsetsActivos(merged).some((t) => t.id === "skills_harness")).toBe(false);
  });
});
