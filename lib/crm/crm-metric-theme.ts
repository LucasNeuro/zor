import {
  BRAND_GREEN,
  BRAND_GREEN_BRIGHT,
  BRAND_MARK_BG,
  BRAND_TEXT_DARK,
} from "@/lib/brand";

/** Tokens visuais oficiais — cards de métricas (tema claro CRM). */
export const CRM_METRIC = {
  value: BRAND_TEXT_DARK,
  label: "#5d7a67",
  sub: "#5d7a67",
  muted: "#7a9a7e",
  border: "#dcebd8",
  borderHover: "#d4ecd0",
  bg: "#ffffff",
  track: "#eef7eb",
  accent: BRAND_GREEN,
  accentBright: BRAND_GREEN_BRIGHT,
  mark: BRAND_MARK_BG,
  danger: "#f85149",
  trendUp: BRAND_GREEN,
  trendDown: "#f85149",
} as const;

export type CrmMetricTone = "default" | "brand" | "success" | "warning" | "danger" | "muted";

const TONE_ACCENT: Record<CrmMetricTone, string> = {
  default: CRM_METRIC.accent,
  brand: CRM_METRIC.accent,
  success: CRM_METRIC.accent,
  warning: CRM_METRIC.muted,
  danger: CRM_METRIC.danger,
  muted: CRM_METRIC.muted,
};

/** Cor do micro-gráfico / barra de progresso. */
export function crmMetricAccentColor(tone: CrmMetricTone = "default", cor?: string): string {
  if (cor) return normalizeMetricColor(cor);
  return TONE_ACCENT[tone];
}

/** Cor do valor numérico — escuro por padrão; vermelho só em alerta. */
export function crmMetricValueColor(
  tone: CrmMetricTone,
  valor: string | number,
  cor?: string
): string {
  if (cor) return normalizeMetricColor(cor);
  const vazio =
    typeof valor === "number"
      ? valor === 0
      : valor === "0" || valor === "R$0" || valor === "—" || valor === "";
  if (tone === "danger" && !vazio) return CRM_METRIC.danger;
  if (tone === "muted" || vazio) return CRM_METRIC.muted;
  return CRM_METRIC.value;
}

/** Converte cores legadas (Tailwind / genéricas) para a paleta Waje. */
export function normalizeMetricColor(cor: string): string {
  const c = cor.toLowerCase();
  const legacyGreen = new Set([
    "#22c55e",
    "#3fb950",
    "#34d399",
    "#86efac",
    "#2d7a36",
    "#2f7a43",
  ]);
  const legacyGold = new Set(["#c9a24a", "#f59e0b", "#eab308", "#e6c06a", "#f97316"]);
  const legacyBlue = new Set(["#3b82f6", "#60a5fa", "#2563eb", "#93c5fd", "#2e67b1"]);
  const legacyGray = new Set(["#94a3b8", "#637a6f", "#8a9a94", "#484f58"]);

  if (legacyGreen.has(c)) return CRM_METRIC.accent;
  if (legacyGold.has(c)) return CRM_METRIC.accent;
  if (legacyBlue.has(c)) return CRM_METRIC.accent;
  if (legacyGray.has(c)) return CRM_METRIC.muted;
  if (c === "#0b2210" || c === "#0f172a" || c === "#12382b") return CRM_METRIC.value;
  if (c === "#ef4444" || c === "#f85149") return CRM_METRIC.danger;
  return cor;
}

export function crmMetricSparklineBarColor(accent: string, index: number, total: number): string {
  const isLast = index === total - 1;
  if (isLast) return accent;
  const hex = accent.replace("#", "");
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, 0.38)`;
  }
  return accent;
}
