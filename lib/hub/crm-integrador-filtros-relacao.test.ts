import { describe, expect, it } from "vitest";
import { ferramentasCrmPorEntidade } from "@/lib/hub/crm-integrador-entidades-shared";

describe("crm integrador filtros relação", () => {
  it("schema de negócio expõe filtro_lead_id", () => {
    const neg = ferramentasCrmPorEntidade().find((f) => f.ferramenta_key === "hub_int_crm_ent_negocio");
    expect(neg).toBeDefined();
    const schema = neg!.parametros_schema as {
      properties: Record<string, { description?: string }>;
    };
    expect(schema.properties.filtro_lead_id).toBeDefined();
    expect(neg!.descricao_modelo).toMatch(/filtro_lead_id/i);
    expect(neg!.descricao_modelo).toMatch(/nunca use só filtro_texto/i);
  });

  it("descrição de lead orienta a guardar UUID", () => {
    const lead = ferramentasCrmPorEntidade().find((f) => f.ferramenta_key === "hub_int_crm_ent_lead");
    expect(lead!.descricao_modelo).toMatch(/UUID/i);
  });
});
