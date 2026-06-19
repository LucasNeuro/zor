import { afterEach, describe, expect, it } from "vitest";
import {
  avaliarEmissaoCoraTenant,
  cnpjMesmoEmissorCora,
  humanizarErroCoraApi,
  validarCnpjClienteCora,
} from "@/lib/cora/cora-emissor";

describe("cora-emissor", () => {
  afterEach(() => {
    delete process.env.CORA_EMISSOR_CNPJ;
  });

  it("bloqueia CNPJ igual ao emissor", () => {
    process.env.CORA_EMISSOR_CNPJ = "12.345.678/0001-99";
    expect(cnpjMesmoEmissorCora("12345678000199")).toBe(true);
    expect(() => validarCnpjClienteCora("12345678000199")).toThrow(/mesmo da conta Cora/);
    expect(avaliarEmissaoCoraTenant("12345678000199").bloqueado).toBe(true);
  });

  it("permite CNPJ diferente do emissor", () => {
    process.env.CORA_EMISSOR_CNPJ = "12.345.678/0001-99";
    expect(cnpjMesmoEmissorCora("98765432000111")).toBe(false);
    expect(avaliarEmissaoCoraTenant("98765432000111").bloqueado).toBe(false);
  });

  it("traduz erro own identity da Cora", () => {
    expect(humanizarErroCoraApi("Cannot create invoice for own identity")).toMatch(
      /mesmo da conta Cora/,
    );
  });
});
