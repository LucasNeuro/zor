import { describe, expect, it } from "vitest";
import {
  FOLLOWUP_PLACEHOLDER_AGENTE_FALLBACK,
  FOLLOWUP_PLACEHOLDER_EMPRESA_FALLBACK,
  interpolarTemplateFollowup,
} from "@/lib/hub/followup-types";

describe("interpolarTemplateFollowup", () => {
  it("substitui {nome} pelo primeiro nome", () => {
    expect(
      interpolarTemplateFollowup("Olá {nome}, tudo bem?", { nome: "Maria Silva" })
    ).toBe("Olá Maria, tudo bem?");
  });

  it("substitui {empresa} e {agente}", () => {
    expect(
      interpolarTemplateFollowup("Oi {nome}, aqui é {agente} da {empresa}.", {
        nome: "João",
        empresa: "Synkron.IA",
        agente: "Dany",
      })
    ).toBe("Oi João, aqui é Dany da Synkron.IA.");
  });

  it("usa fallbacks quando empresa ou agente ausentes", () => {
    expect(
      interpolarTemplateFollowup("Da {empresa} — {agente}", { nome: "Ana" })
    ).toBe(
      `Da ${FOLLOWUP_PLACEHOLDER_EMPRESA_FALLBACK} — ${FOLLOWUP_PLACEHOLDER_AGENTE_FALLBACK}`
    );
  });

  it("substitui placeholders case-insensitive", () => {
    expect(
      interpolarTemplateFollowup("{NOME} · {Empresa} · {AGENTE}", {
        nome: "Lu",
        empresa: "Waje",
        agente: "Bot",
      })
    ).toBe("Lu · Waje · Bot");
  });

  it("mantém {mercado} legado", () => {
    expect(
      interpolarTemplateFollowup("Mercado {mercado} para {nome}", {
        nome: "Pedro",
        mercado: "SP",
      })
    ).toBe("Mercado SP para Pedro");
  });
});
