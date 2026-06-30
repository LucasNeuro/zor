/**
 * Converte horário local Brasil (America/Sao_Paulo, UTC−3 sem DST) em cron UTC de 5 campos.
 * Ex.: 08:00 BRT → `0 11 * * *`
 */
export function cronDiarioUtcFromHoraLocalBr(horaLocal: string): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(horaLocal ?? "").trim());
  if (!m) return null;
  const h = Number.parseInt(m[1], 10);
  const min = Number.parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) {
    return null;
  }
  const BR_OFFSET_HOURS = -3;
  let utcH = h - BR_OFFSET_HOURS;
  const utcMin = min;
  if (utcH < 0) utcH += 24;
  if (utcH >= 24) utcH -= 24;
  return `${utcMin} ${utcH} * * *`;
}

export function horaLocalBrFromCronDiarioUtc(cron: string): string | null {
  const fields = String(cron ?? "").trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const [strMin, strHr, dom, mon] = fields;
  if (dom !== "*" || mon !== "*") return null;
  const utcMin = Number.parseInt(strMin, 10);
  const utcH = Number.parseInt(strHr, 10);
  if (!Number.isFinite(utcMin) || !Number.isFinite(utcH)) return null;
  const BR_OFFSET_HOURS = -3;
  let h = utcH + BR_OFFSET_HOURS;
  if (h < 0) h += 24;
  if (h >= 24) h -= 24;
  return `${String(h).padStart(2, "0")}:${String(utcMin).padStart(2, "0")}`;
}

export type AgendaCicloModo = "horario_fixo" | "intervalo";

export const AGENDA_INTERVALO_OPCOES: ReadonlyArray<{ min: 15 | 60 | 360 | 1440; label: string }> = [
  { min: 15, label: "15 minutos" },
  { min: 60, label: "1 hora" },
  { min: 360, label: "6 horas" },
  { min: 1440, label: "1 vez por dia (intervalo)" },
];
