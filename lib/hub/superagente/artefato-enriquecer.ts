import type { GraficoArtefatoSpec, SecaoArtefatoSpec } from "@/lib/hub/superagente/types";
import { normalizarSecoesArtefatoEntrada } from "@/lib/hub/superagente/artefato-normalizar";

function parseNumeroBr(val: string): number | null {
  const t = val.trim();
  if (!t || t === "—" || t === "-") return null;
  const limpo = t
    .replace(/[R$\s]/gi, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

function indiceColunaNumerica(colunas: string[], linhas: string[][]): number {
  for (let c = 0; c < colunas.length; c++) {
    let nums = 0;
    for (const row of linhas) {
      if (parseNumeroBr(String(row[c] ?? "")) !== null) nums++;
    }
    if (nums >= 2) return c;
  }
  return -1;
}

function graficoDeTabela(
  titulo: string,
  colunas: string[],
  linhas: string[][],
  tipo: GraficoArtefatoSpec["tipo"] = "bar"
): GraficoArtefatoSpec | null {
  if (!linhas.length || colunas.length < 2) return null;
  const idxNum = indiceColunaNumerica(colunas, linhas);
  if (idxNum < 0) return null;

  const idxLabel = idxNum === 0 ? 1 : 0;
  const labels: string[] = [];
  const data: number[] = [];

  for (const row of linhas.slice(0, 12)) {
    const n = parseNumeroBr(String(row[idxNum] ?? ""));
    if (n === null) continue;
    const label = String(row[idxLabel] ?? "").trim() || `Item ${labels.length + 1}`;
    labels.push(label.slice(0, 40));
    data.push(n);
  }

  if (labels.length < 2) return null;

  return {
    tipo: labels.length <= 6 && tipo === "bar" ? "doughnut" : tipo,
    titulo,
    labels,
    datasets: [
      {
        label: colunas[idxNum] || "Valor",
        data,
      },
    ],
  };
}

/** Remove secções vazias que geram barras/cards em branco no relatório. */
export function filtrarSecoesVazias(secoes: SecaoArtefatoSpec[]): SecaoArtefatoSpec[] {
  return secoes.filter((sec) => {
    if (sec.tipo === "kpi_row") return sec.itens.length > 0;
    if (sec.tipo === "grafico") {
      const g = sec.grafico;
      return g.labels.length > 0 && g.datasets.some((d) => d.data.length > 0);
    }
    if (sec.tipo === "tabela") return sec.colunas.length > 0 && sec.linhas.length > 0;
    if (sec.tipo === "texto") {
      const t = (sec.markdown || sec.html_seguro || "").trim();
      return t.length > 24;
    }
    return true;
  });
}

/** Insere gráficos derivados de tabelas quando o modelo só enviou texto/tabela. Preserva ordem original. */
export function enriquecerSecoesArtefato(secoes: SecaoArtefatoSpec[]): SecaoArtefatoSpec[] {
  const normalizadas = normalizarSecoesArtefatoEntrada(secoes);
  const temGrafico = normalizadas.some((s) => s.tipo === "grafico");
  if (temGrafico) return filtrarSecoesVazias(normalizadas);

  const out: SecaoArtefatoSpec[] = [];
  for (const sec of normalizadas) {
    out.push(sec);
    if (sec.tipo === "tabela" && sec.linhas.length >= 2) {
      const g = graficoDeTabela(
        sec.titulo?.trim() || `Gráfico — ${sec.colunas.join(" / ").slice(0, 60)}`,
        sec.colunas,
        sec.linhas
      );
      if (g) out.push({ tipo: "grafico", grafico: g });
    }
  }
  return filtrarSecoesVazias(out);
}
