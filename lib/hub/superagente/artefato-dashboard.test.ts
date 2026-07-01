import { describe, expect, it } from "vitest";
import { BRAND_GREEN } from "@/lib/brand";
import { KPI_CORES, PALETA_DASHBOARD } from "./artefato-paleta";
import {
  normalizarLinhasTabela,
  preencherTabelaVaziaDeGrafico,
  normalizarSecoesArtefatoEntrada,
} from "./artefato-normalizar";
import { enriquecerSecoesArtefato } from "./artefato-enriquecer";
import { gerarHtmlArtefatoCanvas } from "./artefato-canvas";
import type { ArtefatoBranding } from "./artefato-branding";

const brandingStub: ArtefatoBranding = {
  agenteNome: "Lucca",
  agenteSlug: "lucca",
  avatarUrl: "https://example.com/a.png",
  cargo: "Gestor Financeiro",
  geradoEm: "1 jul. 2026",
  plataformaNome: "Synkron.IA",
};

describe("artefato normalizar tabelas", () => {
  it("converte linhas como objetos em array de células", () => {
    const linhas = normalizarLinhasTabela(
      ["Código", "Valor", "Status"],
      [
        { Código: "NEG-2026-0001", Valor: "R$ 100", Status: "aberto" },
        { codigo: "NEG-2026-0002", valor: "R$ 200", status: "pendente" },
      ]
    );
    expect(linhas).toHaveLength(2);
    expect(linhas[0]![0]).toBe("NEG-2026-0001");
    expect(linhas[1]![1]).toBe("R$ 200");
  });

  it("preenche tabela vazia a partir do gráfico", () => {
    const linhas = preencherTabelaVaziaDeGrafico(
      ["Código", "Valor (R$)", "Status"],
      [],
      {
        tipo: "bar",
        labels: ["NEG-2026-0004", "NEG-2026-0002"],
        datasets: [{ label: "Valor", data: [12458.9, 5690] }],
      }
    );
    expect(linhas).toHaveLength(2);
    expect(linhas[0]![0]).toBe("NEG-2026-0004");
    expect(linhas[0]![1]).toContain("12");
    expect(linhas[0]![2]).toBe("aberto");
  });

  it("enriquecer preenche tabela vazia quando há gráfico no payload", () => {
    const secoes = enriquecerSecoesArtefato([
      {
        tipo: "grafico",
        grafico: {
          tipo: "bar",
          titulo: "Valor",
          labels: ["NEG-A", "NEG-B"],
          datasets: [{ label: "Valor", data: [100, 200] }],
        },
      },
      {
        tipo: "tabela",
        titulo: "Detalhe",
        colunas: ["Código", "Valor"],
        linhas: [],
      },
    ]);
    const tabela = secoes.find((s) => s.tipo === "tabela");
    expect(tabela?.tipo).toBe("tabela");
    if (tabela?.tipo === "tabela") {
      expect(tabela.linhas.length).toBe(2);
    }
  });
});

describe("artefato dashboard Waje", () => {
  it("paleta usa verde marca Waje", () => {
    expect(PALETA_DASHBOARD[0]).toBe(BRAND_GREEN);
    expect(KPI_CORES.verde.bg).toBe(BRAND_GREEN);
  });

  it("gerarHtml inclui tabela com linhas e KPI Waje", () => {
    const html = gerarHtmlArtefatoCanvas(
      {
        titulo: "Financeiro",
        tema: "claro",
        secoes: normalizarSecoesArtefatoEntrada([
          {
            tipo: "kpi_row",
            itens: [{ label: "Receita", valor: "R$ 19.204", cor: "verde" }],
          },
          {
            tipo: "tabela",
            titulo: "Negócios",
            colunas: ["Código", "Valor"],
            linhas: [{ Código: "NEG-1", Valor: "R$ 100" }],
          },
        ]),
      },
      brandingStub
    );
    expect(html).toContain("NEG-1");
    expect(html).toContain("--kpi-bg:#3f9848");
    expect(html).toContain("table-title");
  });
});
