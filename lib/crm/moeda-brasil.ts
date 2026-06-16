/** Máscara e parsing de valores monetários em Real (BRL). */

const fmtMoeda = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Converte número para exibição no input (ex.: 560 → "560,00"). */
export function numeroParaMoedaMascara(valor: number): string {
  if (!Number.isFinite(valor) || valor < 0) return "";
  return fmtMoeda.format(valor);
}

/**
 * Aplica máscara monetária enquanto o usuário digita (apenas dígitos → centavos).
 * Ex.: "56000" → "560,00"
 */
export function formatarMoedaMascara(valor: string): string {
  const digits = valor.replace(/\D/g, "");
  if (!digits) return "";
  const cents = Number(digits);
  if (!Number.isFinite(cents)) return "";
  return fmtMoeda.format(cents / 100);
}

/** Extrai o valor numérico de um campo mascarado (ex.: "1.234,56" → 1234.56). */
export function moedaMascaraParaNumero(valor: string): number | null {
  const digits = valor.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits) / 100;
  return Number.isFinite(n) ? n : null;
}
