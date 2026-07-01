import { BRAND_GREEN, BRAND_GREEN_BRIGHT, BRAND_MARK_BG } from "@/lib/brand";

/** Paleta dashboard — cores Waje (verdes marca + acento lima). */
export const PALETA_DASHBOARD = [
  BRAND_GREEN,
  "#5dca68",
  BRAND_GREEN_BRIGHT,
  "#2d7a36",
  "#1e5c28",
  "#7bc67f",
  BRAND_MARK_BG,
  "#a8e6a8",
] as const;

export type KpiCorToken = "verde" | "azul" | "rosa" | "laranja" | "teal" | "roxo";

/** KPI cards — paleta Waje (verde primário, variações e acento lima). */
export const KPI_CORES: Record<KpiCorToken, { bg: string; fg: string }> = {
  verde: { bg: BRAND_GREEN, fg: "#ffffff" },
  azul: { bg: "#2d7a36", fg: "#ffffff" },
  rosa: { bg: BRAND_MARK_BG, fg: BRAND_GREEN_BRIGHT },
  laranja: { bg: "#5dca68", fg: BRAND_MARK_BG },
  teal: { bg: "#1e5c28", fg: "#e8f5e9" },
  roxo: { bg: BRAND_GREEN_BRIGHT, fg: BRAND_MARK_BG },
};

/** Ordem por defeito nos KPIs — prioriza verde Waje. */
export const KPI_ORDEM_WAJE: KpiCorToken[] = ["verde", "azul", "laranja", "teal", "roxo", "rosa"];

export function coresPorFatia(n: number, offset = 0): string[] {
  if (n <= 0) return [];
  return Array.from({ length: n }, (_, i) => PALETA_DASHBOARD[(i + offset) % PALETA_DASHBOARD.length]!);
}

export function corDatasetGrafico(
  tipo: "bar" | "line" | "pie" | "doughnut",
  datasetIndex: number,
  dataLen: number,
  corExplicita?: string
): string | string[] {
  if (corExplicita && (tipo === "line" || dataLen <= 1)) return corExplicita;
  if (tipo === "pie" || tipo === "doughnut" || (tipo === "bar" && dataLen > 1)) {
    return coresPorFatia(dataLen, datasetIndex);
  }
  return PALETA_DASHBOARD[datasetIndex % PALETA_DASHBOARD.length]!;
}
