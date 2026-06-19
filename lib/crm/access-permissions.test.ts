import { describe, expect, it } from "vitest";
import { canAccessCrmPath, defaultCrmLandingPath } from "@/lib/crm/access-permissions";

describe("defaultCrmLandingPath", () => {
  it("envia atendente sem dashboard para módulo permitido (sem loop /crm)", () => {
    const ctx = {
      baseRole: "atendente",
      permissoes: { atendimento: true, leads: false, negocios: false, automacoes: false, configuracoes: false },
      wajeOwner: false,
    };

    expect(canAccessCrmPath("/crm/painel", ctx)).toBe(false);
    expect(defaultCrmLandingPath(ctx)).toBe("/crm/canais");
  });

  it("mantém admin no painel", () => {
    const ctx = { baseRole: "admin", permissoes: null, wajeOwner: false };
    expect(defaultCrmLandingPath(ctx)).toBe("/crm/painel?tab=visao-geral&view=paineis");
  });
});
