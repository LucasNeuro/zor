import type { GraficoArtefatoSpec, SecaoArtefatoSpec } from "@/lib/hub/superagente/types";

function normCol(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function valorCelulaDeObjeto(row: Record<string, unknown>, coluna: string): string {
  const alvo = normCol(coluna);
  for (const [k, v] of Object.entries(row)) {
    if (normCol(k) === alvo) return String(v ?? "");
  }
  return "";
}

/** Aceita linhas como string[][] ou array de objetos { coluna: valor }. */
export function normalizarLinhasTabela(colunas: string[], linhasRaw: unknown[]): string[][] {
  if (!Array.isArray(linhasRaw)) return [];

  const out: string[][] = [];
  for (const row of linhasRaw) {
    if (Array.isArray(row)) {
      const cells = row.map((c) => String(c ?? ""));
      if (cells.some((c) => c.trim())) out.push(cells);
      continue;
    }
    if (row && typeof row === "object") {
      const o = row as Record<string, unknown>;
      if (colunas.length) {
        const cells = colunas.map((col) => valorCelulaDeObjeto(o, col));
        if (cells.some((c) => c.trim())) out.push(cells);
      } else {
        const cells = Object.values(o).map((v) => String(v ?? ""));
        if (cells.some((c) => c.trim())) out.push(cells);
      }
    }
  }
  return out;
}

function indiceColuna(colunas: string[], aliases: string[]): number {
  for (let i = 0; i < colunas.length; i++) {
    const c = normCol(colunas[i] ?? "");
    if (aliases.some((a) => c.includes(a) || a.includes(c))) return i;
  }
  return -1;
}

function formatMoedaBr(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Preenche tabela só com cabeçalho usando labels/dados do gráfico no mesmo relatório. */
export function preencherTabelaVaziaDeGrafico(
  colunas: string[],
  linhas: string[][],
  grafico: GraficoArtefatoSpec | undefined
): string[][] {
  if (linhas.length || !grafico?.labels?.length) return linhas;
  const data = grafico.datasets[0]?.data ?? [];
  if (!data.length) return linhas;

  const idxCodigo = indiceColuna(colunas, ["codigo", "neg", "titulo", "nome"]);
  const idxTitulo = indiceColuna(colunas, ["titulo", "nome"]);
  const idxValor = indiceColuna(colunas, ["valor", "r$", "montante"]);
  const idxLead = indiceColuna(colunas, ["lead", "cliente"]);
  const idxStatus = indiceColuna(colunas, ["status", "estado", "situacao"]);

  return grafico.labels.map((label, i) => {
    const row = colunas.map(() => "—");
    if (idxCodigo >= 0) row[idxCodigo] = String(label);
    const rawVal = data[i];
    const num =
      typeof rawVal === "number"
        ? rawVal
        : Number(String(rawVal ?? "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
    if (idxValor >= 0 && Number.isFinite(num) && num > 0) {
      row[idxValor] = formatMoedaBr(num);
    }
    if (idxTitulo >= 0 && idxTitulo !== idxCodigo) row[idxTitulo] = String(label);
    if (idxLead >= 0) row[idxLead] = "—";
    if (idxStatus >= 0) row[idxStatus] = "aberto";
    return row;
  });
}

export function normalizarSecoesArtefatoEntrada(secoes: SecaoArtefatoSpec[]): SecaoArtefatoSpec[] {
  const graficos = secoes.filter((s): s is Extract<SecaoArtefatoSpec, { tipo: "grafico" }> => s.tipo === "grafico");

  return secoes.map((sec) => {
    if (sec.tipo !== "tabela") return sec;
    let linhas = normalizarLinhasTabela(sec.colunas, sec.linhas as unknown[]);
    if (!linhas.length && graficos.length) {
      linhas = preencherTabelaVaziaDeGrafico(sec.colunas, linhas, graficos[0]?.grafico);
    }
    return { ...sec, linhas };
  });
}
