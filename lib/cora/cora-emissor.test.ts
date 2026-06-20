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

  it("detecta CNPJ igual ao emissor sem bloquear emissão", () => {
    process.env.CORA_EMISSOR_CNPJ = "12.345.678/0001-99";
    expect(cnpjMesmoEmissorCora("12345678000199")).toBe(true);
    expect(() => validarCnpjClienteCora("12345678000199")).not.toThrow();
    expect(avaliarEmissaoCoraTenant("12345678000199").bloqueado).toBe(false);
    expect(avaliarEmissaoCoraTenant("12345678000199").motivo).toMatch(/pagador.*credenciais Cora/s);
  });

  it("permite CNPJ diferente do emissor", () => {
    process.env.CORA_EMISSOR_CNPJ = "12.345.678/0001-99";
    expect(cnpjMesmoEmissorCora("98765432000111")).toBe(false);
    expect(avaliarEmissaoCoraTenant("98765432000111").bloqueado).toBe(false);
  });

  it("traduz erro own identity da Cora com credencial errada", () => {
    process.env.CORA_EMISSOR_CNPJ = "62.449.971/0001-70";
    const msg = humanizarErroCoraApi("Cannot create invoice for own identity", "65912793000160");
    expect(msg).toMatch(/Documento enviado como pagador.*65\.912\.793/);
    expect(msg).toMatch(/certificado\/client_id/i);
  });

  it("traduz erro own identity quando pagador = emissor env", () => {
    process.env.CORA_EMISSOR_CNPJ = "62.449.971/0001-70";
    expect(humanizarErroCoraApi("Cannot create invoice for own identity", "62449971000170")).toMatch(
      /pagador.*credenciais Cora/s,
    );
  });
});
