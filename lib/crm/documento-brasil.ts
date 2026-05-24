/** Validação e máscara de CPF/CNPJ (algoritmo oficial dos dígitos verificadores). */

export function normalizarDocumento(valor: string): string {
  return valor.replace(/\D/g, "");
}

/** CPF válido (11 dígitos + módulo 11). */
export function validarCpf(digits: string): boolean {
  const d = normalizarDocumento(digits);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i], 10) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(d[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i], 10) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  return remainder === parseInt(d[10], 10);
}

/** CNPJ válido (14 dígitos + dígitos verificadores). */
export function validarCnpj(digits: string): boolean {
  const d = normalizarDocumento(digits);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;
  const calc = (doc: string, weights: number[]) => {
    const sum = weights.reduce((acc, w, i) => acc + parseInt(doc[i], 10) * w, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return calc(d, w1) === parseInt(d[12], 10) && calc(d, w2) === parseInt(d[13], 10);
}

export function formatarCpfMascara(valor: string): string {
  const d = normalizarDocumento(valor).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatarCnpjMascara(valor: string): string {
  const d = normalizarDocumento(valor).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  }
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function documentoCompleto(tipo: "PF" | "PJ", valor: string): boolean {
  const d = normalizarDocumento(valor);
  return tipo === "PF" ? d.length === 11 : d.length === 14;
}

/** Comprimento correto + dígitos verificadores (CPF/CNPJ). */
export function documentoValido(tipo: "PF" | "PJ", valor: string): boolean {
  const d = normalizarDocumento(valor);
  if (!documentoCompleto(tipo, d)) return false;
  return tipo === "PF" ? validarCpf(d) : validarCnpj(d);
}

export function mensagemDocumentoInvalido(tipo: "PF" | "PJ"): string {
  return tipo === "PF"
    ? "CPF inválido. Confira os 11 dígitos (validação oficial)."
    : "CNPJ inválido. Confira os 14 dígitos (validação oficial).";
}
