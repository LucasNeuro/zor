import type { GraficoArtefatoSpec, SecaoArtefatoSpec } from "@/lib/hub/superagente/types";

const CORES_GRAFICO = ["#92ff00", "#3f9848", "#5dca68", "#b8e6cf", "#2d6a3e", "#c8f7d0"];

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
    tipo: labels.length <= 5 && tipo === "bar" ? "doughnut" : tipo,
    titulo,
    labels,
    datasets: [
      {
        label: colunas[idxNum] || "Valor",
        data,
        cor: CORES_GRAFICO[0],
      },
    ],
  };
}

/** Insere gráficos derivados de tabelas quando o modelo só enviou texto/tabela. */
export function enriquecerSecoesArtefato(secoes: SecaoArtefatoSpec[]): SecaoArtefatoSpec[] {
  const temGrafico = secoes.some((s) => s.tipo === "grafico");
  if (temGrafico) return secoes;

  const out: SecaoArtefatoSpec[] = [];
  for (const sec of secoes) {
    out.push(sec);
    if (sec.tipo === "tabela" && sec.linhas.length >= 2) {
      const g = graficoDeTabela(
        `Gráfico — ${sec.colunas.join(" / ").slice(0, 60)}`,
        sec.colunas,
        sec.linhas
      );
      if (g) out.push({ tipo: "grafico", grafico: g });
    }
  }
  return out;
}
