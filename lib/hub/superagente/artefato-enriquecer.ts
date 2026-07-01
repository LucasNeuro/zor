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

function ordenSecao(tipo: SecaoArtefatoSpec["tipo"]): number {
  if (tipo === "kpi_row") return 0;
  if (tipo === "grafico") return 1;
  if (tipo === "tabela") return 2;
  return 3;
}

/** Normaliza tabelas, preenche linhas vazias e insere gráficos derivados quando faltar. */
export function enriquecerSecoesArtefato(secoes: SecaoArtefatoSpec[]): SecaoArtefatoSpec[] {
  const normalizadas = normalizarSecoesArtefatoEntrada(secoes);
  const temGrafico = normalizadas.some((s) => s.tipo === "grafico");

  let out: SecaoArtefatoSpec[] = temGrafico ? [...normalizadas] : [];

  if (!temGrafico) {
    for (const sec of normalizadas) {
      out.push(sec);
      if (sec.tipo === "tabela" && sec.linhas.length >= 2) {
        const g = graficoDeTabela(
          sec.titulo?.trim() || `Distribuição — ${sec.colunas.join(" / ").slice(0, 60)}`,
          sec.colunas,
          sec.linhas
        );
        if (g) out.push({ tipo: "grafico", grafico: g });
      }
    }
  }

  return [...out].sort((a, b) => ordenSecao(a.tipo) - ordenSecao(b.tipo));
}
