import { describe, expect, it } from "vitest";
import {
  isWaPresetId,
  personalizarPlaybookTemplate,
  WA_PRESET_CARGO_SLUG,
  waPresetHintsParaCriacao,
} from "./wa-conversacao-preset-shared";

describe("wa-conversacao-preset", () => {
  it("reconhece preset id válido", () => {
    expect(isWaPresetId("conversacao_universal")).toBe(true);
    expect(isWaPresetId("outro")).toBe(false);
  });

  it("personaliza nome no template", () => {
    const out = personalizarPlaybookTemplate("Olá [Nome], assistente virtual.", "Mari");
    expect(out).toContain("Mari");
    expect(out).not.toContain("[Nome]");
  });

  it("hints de criação incluem cargo e modo whatsapp", () => {
    const hints = waPresetHintsParaCriacao();
    expect(hints.cargo_slug).toBe(WA_PRESET_CARGO_SLUG);
    expect(hints.modo_operacao).toBe("canal_whatsapp");
    expect(hints.motor_ferramentas_habilitado).toBe(true);
    expect(hints.uso_ferramentas_ia.hub_whatsapp_menu).toBe(true);
    expect(hints.uso_ferramentas_ia.hub_atualizar_lead).toBe(true);
  });
});
