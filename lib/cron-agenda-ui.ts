/**
 * Helpers para UI de agendamento → expressão cron 5 campos (min hor dom mon dow)
 * alinhada a `cronMatchesUtc` em lib/ciclos-dispatch.ts (dow 0=domingo … 6=sábado, UTC).
 */

/** dias da semana no formato cron UNIX / JS getUTCDay(): 0 = Domingo … 6 = Sábado */
export function buildCronUtc(minute: number, hour: number, daysOfWeek: number[]): string {
  const m = Math.max(0, Math.min(59, Math.floor(minute)));
  const h = Math.max(0, Math.min(23, Math.floor(hour)));
  const uniq = [
    ...new Set(
      daysOfWeek.map((d) => Math.floor(d)).filter((d) => d >= 0 && d <= 6)
    ),
  ].sort((a, b) => a - b);
  const dow = uniq.length === 0 || uniq.length === 7 ? "*" : uniq.join(",");
  return `${m} ${h} * * ${dow}`;
}

/** Interpreta apenas padrões "mesma hora todos os dias/dias escolhidos": `m h * * dow` */
export function parseCronAgendaUi(
  expr: string
): { minute: number; hour: number; daysOfWeek: number[] } | null {
  const fields = expr.trim().split(/\s+/).filter(Boolean);
  if (fields.length !== 5) return null;
  const [strMin, strHr, strDom, strMon, strDow] = fields;
  if (strDom !== "*" && strDom !== "?") return null;
  if (strMon !== "*" && strMon !== "?") return null;

  const minute = Number.parseInt(strMin, 10);
  const hour = Number.parseInt(strHr, 10);
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) return null;
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;

  if (strDow === "*" || strDow === "?") {
    return { minute, hour, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] };
  }

  const days: number[] = [];
  for (const part of strDow.split(",")) {
    const p = part.trim();
    if (!p) continue;
    if (p.includes("-")) {
      const [a0, b0] = p.split("-").map((x) => Number.parseInt(x.trim(), 10));
      if (!Number.isFinite(a0) || !Number.isFinite(b0)) return null;
      const a = Math.min(a0, b0);
      const b = Math.max(a0, b0);
      for (let i = a; i <= b; i++) {
        if (i >= 0 && i <= 6) days.push(i);
      }
    } else {
      const n = Number.parseInt(p, 10);
      if (!Number.isFinite(n) || n < 0 || n > 6) return null;
      days.push(n);
    }
  }
  const uniq = [...new Set(days)].sort((a, b) => a - b);
  if (uniq.length === 0) return null;
  return { minute, hour, daysOfWeek: uniq };
}
