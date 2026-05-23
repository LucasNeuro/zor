export type AnalyticsPeriodo = "24h" | "7d" | "30d";

const MS: Record<AnalyticsPeriodo, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export function parseAnalyticsPeriodo(raw: string | null): AnalyticsPeriodo {
  if (raw === "7d" || raw === "30d") return raw;
  return "24h";
}

export function sinceFromPeriodo(periodo: AnalyticsPeriodo): string {
  return new Date(Date.now() - MS[periodo]).toISOString();
}

export const ANALYTICS_PERIODOS: { label: string; value: AnalyticsPeriodo }[] = [
  { label: "24h", value: "24h" },
  { label: "7 dias", value: "7d" },
  { label: "30 dias", value: "30d" },
];

export function periodoLabel(periodo: AnalyticsPeriodo): string {
  return ANALYTICS_PERIODOS.find((p) => p.value === periodo)?.label ?? periodo;
}
