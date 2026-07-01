import { describe, expect, it } from "vitest";
import {
  limparPromptMistralInterno,
  normalizarBulletsCargo,
  sanitizarCatalogoInterno,
} from "@/lib/hub/superagente/cargo-harness-sanitize";

describe("cargo-harness-sanitize", () => {
  it("junta bullets fragmentados", () => {
    const out = normalizarBulletsCargo([
      "Monitorar métricas em tempo real (leads ativos",
      "taxa de conversão)",
    ]);
    expect(out).toEqual(["Monitorar métricas em tempo real (leads ativos taxa de conversão)"]);
  });

  it("remove nao_pode que contradiz CRUD interno", () => {
    const { naoPodeFazer } = sanitizarCatalogoInterno(
      ["Gerar relatórios"],
      ["Modificar dados sem validação automática", "Acessar dados de clientes sem permissão"]
    );
    expect(naoPodeFazer.some((x) => /modificar dados/i.test(x))).toBe(false);
    expect(naoPodeFazer.some((x) => /inventar números/i.test(x))).toBe(true);
  });

  it("limpa secções contraditórias do prompt Mistral", () => {
    const raw = `## Missão
Analista financeiro.

## Não pode fazer
- Nunca modifique dados sem validação
- Só leitura no CRM

## Tom
Objetivo.`;
    const out = limparPromptMistralInterno(raw);
    expect(out).not.toMatch(/Não pode fazer/i);
    expect(out).not.toMatch(/modifique dados/i);
    expect(out).toMatch(/Missão/);
  });
});
