import { describe, expect, it } from "vitest";
import {
  deveReforcarLoopEscrita,
  ferramentaEscritaHub,
  houveToolEscritaComSucesso,
  respostaPrometeEscritaPendente,
} from "./enforce-write-completion";

describe("enforce-write-completion", () => {
  it("detecta promessa de escrita pendente", () => {
    expect(respostaPrometeEscritaPendente("Vou criar o negócio agora.")).toBe(true);
    expect(respostaPrometeEscritaPendente("Um momento, vou registar.")).toBe(true);
    expect(respostaPrometeEscritaPendente("Negócio criado com sucesso.")).toBe(false);
  });

  it("identifica tools de escrita hub", () => {
    expect(ferramentaEscritaHub("hub_int_crm_ent_negocio")).toBe(true);
    expect(ferramentaEscritaHub("hub_int_crm_atualizar_lead")).toBe(true);
    expect(ferramentaEscritaHub("hub_int_crm_consultar")).toBe(false);
  });

  it("reforça loop quando prometeu gravar sem tool ok", () => {
    expect(
      deveReforcarLoopEscrita("Vou criar o negócio. Um momento.", [
        { nome: "hub_int_crm_consultar", ok: true, resultadoPreview: "{}" },
      ])
    ).toBe(true);

    expect(
      deveReforcarLoopEscrita("Vou criar o negócio.", [
        { nome: "hub_int_crm_ent_negocio", ok: true, resultadoPreview: '{"ok":true}' },
      ])
    ).toBe(false);
  });

  it("houveToolEscritaComSucesso exige ok true", () => {
    expect(
      houveToolEscritaComSucesso([
        { nome: "hub_int_crm_ent_negocio", ok: false, resultadoPreview: "" },
      ])
    ).toBe(false);
    expect(
      houveToolEscritaComSucesso([
        { nome: "hub_int_crm_ent_negocio", ok: true, resultadoPreview: "" },
      ])
    ).toBe(true);
  });
});
