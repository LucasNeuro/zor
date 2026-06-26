/** Fusos comuns para follow-up WhatsApp (IANA). */
export const FOLLOWUP_TIMEZONE_PRESETS = [
  { value: "America/Sao_Paulo", label: "Brasil (São Paulo)" },
  { value: "America/Manaus", label: "Brasil (Manaus)" },
  { value: "America/Fortaleza", label: "Brasil (Fortaleza)" },
  { value: "America/Recife", label: "Brasil (Recife)" },
  { value: "America/Cuiaba", label: "Brasil (Cuiabá)" },
  { value: "America/Porto_Velho", label: "Brasil (Porto Velho)" },
  { value: "America/Noronha", label: "Brasil (Fernando de Noronha)" },
  { value: "America/New_York", label: "EUA (Nova York)" },
  { value: "Europe/Lisbon", label: "Portugal (Lisboa)" },
] as const;

export function timezoneFollowupLabel(tz: string): string {
  const found = FOLLOWUP_TIMEZONE_PRESETS.find((p) => p.value === tz);
  return found?.label ?? tz;
}
