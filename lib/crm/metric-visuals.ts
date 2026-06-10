/** Normaliza valores para barras de sparkline (0.15–1). */
export function normalizeSparkline(values: number[], minHeight = 0.15): number[] {
  if (!values.length) return [0.3, 0.45, 0.35, 0.5, 0.4];
  const max = Math.max(...values, 1);
  return values.map((v) => Math.max(minHeight, v / max));
}

/** Distribui contagens em até `bars` colunas (preenche com mínimo visual). */
export function sparklineFromCounts(counts: number[], bars = 5): number[] {
  const slice = counts.filter((c) => c >= 0).slice(0, bars);
  while (slice.length < bars) slice.push(0);
  return normalizeSparkline(slice);
}

export function trendLabel(part: number, whole: number, suffix = "%"): string | undefined {
  if (whole <= 0 || part <= 0) return undefined;
  const pct = Math.round((part / whole) * 1000) / 10;
  return `${pct}${suffix}`;
}

export function trendPositive(part: number, whole: number, invert = false): boolean {
  if (whole <= 0) return true;
  const ratio = part / whole;
  return invert ? ratio <= 0.5 : ratio >= 0.5;
}

/** Sparkline sintético estável a partir de um número (quando não há série temporal). */
export function sparklineFromSeed(seed: number, bars = 5): number[] {
  const base = Math.max(1, Math.abs(Math.round(seed)));
  const vals: number[] = [];
  for (let i = 0; i < bars; i++) {
    const wave = Math.sin((base + i) * 1.7) * 0.35 + 0.65;
    const mod = ((base * (i + 3)) % 7) / 10;
    vals.push(Math.max(0.2, wave + mod * 0.25));
  }
  return normalizeSparkline(vals);
}
