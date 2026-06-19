import { describe, expect, it } from "vitest";
import {
  documentoProntoParaCora,
  inferirTipoDocumento,
  mesclarPerfilCobranca,
  perfilCobrancaFromTenantCadastral,
  perfilCobrancaFromTenantSettings,
  perfilCobrancaFromUserRow,
} from "@/lib/hub/user-billing-cadastral";

describe("user-billing-cadastral", () => {
  it("infere CPF e CNPJ pelo tamanho", () => {
    expect(inferirTipoDocumento("12345678901")).toBe("CPF");
    expect(inferirTipoDocumento("12345678000199")).toBe("CNPJ");
  });

  it("monta perfil a partir de users", () => {
    const profile = perfilCobrancaFromUserRow({
      id: "u1",
      name: "João",
      email: "joao@test.com",
      document_type: "CNPJ",
      document: "12.345.678/0001-99",
      billing_legal_name: "Empresa Teste LTDA",
      billing_cep: "01310100",
      billing_logradouro: "Av Paulista",
      billing_numero: "1000",
      billing_bairro: "Bela Vista",
      billing_cidade: "São Paulo",
      billing_uf: "sp",
    });

    expect(profile?.document).toBe("12345678000199");
    expect(profile?.document_type).toBe("CNPJ");
    expect(profile?.legal_name).toBe("Empresa Teste LTDA");
    expect(profile?.uf).toBe("SP");
    expect(profile?.fonte).toBe("user");
  });

  it("mescla user com cadastro tenant (endereço faltante no user)", () => {
    const user = perfilCobrancaFromUserRow({
      id: "u1",
      name: "João",
      email: "joao@test.com",
      document_type: "CNPJ",
      document: "98765432000111",
      billing_legal_name: "Cliente LTDA",
    });

    const merged = mesclarPerfilCobranca(user, {
      cnpj: "98765432000111",
      razao_social: "Cliente LTDA",
      nome_fantasia: null,
      situacao_cadastral: null,
      email: "financeiro@cliente.com",
      telefone: "11999999999",
      cep: "01000000",
      logradouro: "Rua A",
      numero: "10",
      complemento: null,
      bairro: "Centro",
      cidade: "São Paulo",
      estado: "SP",
      cnae_principal: null,
      site: null,
      descricao_curta: null,
      atualizado_em: null,
    });

    expect(merged?.document).toBe("98765432000111");
    expect(merged?.logradouro).toBe("Rua A");
    expect(merged?.email).toBe("joao@test.com");
    expect(merged?.fonte).toBe("merged");
  });

  it("fallback para cadastro tenant quando user sem documento", () => {
    const fromTenant = perfilCobrancaFromTenantCadastral({
      cnpj: "11222333000144",
      razao_social: "Tenant SA",
      nome_fantasia: "Tenant",
      situacao_cadastral: null,
      email: "t@x.com",
      telefone: null,
      cep: null,
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      cidade: null,
      estado: null,
      cnae_principal: null,
      site: null,
      descricao_curta: null,
      atualizado_em: null,
    });

    expect(fromTenant?.document_type).toBe("CNPJ");
    expect(documentoProntoParaCora(fromTenant?.document)).toBe(true);
  });

  it("lê CPF/CNPJ de hub_tenants.settings", () => {
    const profile = perfilCobrancaFromTenantSettings(
      {
        registration_type: "PJ",
        cnpj: "11.222.333/0001-44",
        trade_name: "Cliente X",
        address: {
          cep: "01310-100",
          logradouro: "Av Paulista",
          numero: "100",
          bairro: "Bela Vista",
          cidade: "São Paulo",
          uf: "SP",
        },
        primary_contact: { name: "Maria", email: "maria@x.com", phone: "11999999999" },
      },
      "Cliente X",
    );
    expect(profile?.document).toBe("11222333000144");
    expect(profile?.email).toBe("maria@x.com");
    expect(profile?.logradouro).toBe("Av Paulista");
  });
});
