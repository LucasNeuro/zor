import type { PainelKpiCard } from "@/lib/crm/painel-tabs";

export function painelKpiProgressPct(kpi: PainelKpiCard): number {
  const { valor } = kpi;

  if (typeof valor === "string") {
    if (valor.includes("%")) {
      const n = parseFloat(valor.replace("%", "").replace(",", "."));
      return Math.min(100, Math.max(0, Number.isFinite(n) ? n : 0));
    }
    if (valor.startsWith("R$")) {
      const raw = valor.replace(/[^\d,]/g, "").replace(",", ".");
      const n = parseFloat(raw) || 0;
      if (n <= 0) return 0;
      return Math.min(100, Math.round((n / 250_000) * 100));
    }
  }

  if (typeof valor === "number") {
    if (valor <= 0) return 0;
    return Math.min(100, Math.max(12, Math.round(valor * 15)));
  }

  return 0;
}
