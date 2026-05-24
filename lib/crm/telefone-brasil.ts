/**
 * Parse e formatação de telefones BR (WhatsApp / CRM).
 * O prefixo 55 nos dados é o código internacional do Brasil — não é campo extra.
 */

export type RegiaoBrasil = "norte" | "nordeste" | "centro-oeste" | "sudeste" | "sul";

export type TelefoneBrParsed = {
  /** Apenas dígitos, formato E.164 BR (ex.: 5511987654321) */
  e164: string;
  pais: "55";
  ddd: string | null;
  numero: string;
  uf: string | null;
  regiao: RegiaoBrasil | null;
};

const DDD_UF: Record<string, string> = {
  "11": "SP", "12": "SP", "13": "SP", "14": "SP", "15": "SP", "16": "SP", "17": "SP", "18": "SP", "19": "SP",
  "21": "RJ", "22": "RJ", "24": "RJ",
  "27": "ES", "28": "ES",
  "31": "MG", "32": "MG", "33": "MG", "34": "MG", "35": "MG", "37": "MG", "38": "MG",
  "41": "PR", "42": "PR", "43": "PR", "44": "PR", "45": "PR", "46": "PR",
  "47": "SC", "48": "SC", "49": "SC",
  "51": "RS", "53": "RS", "54": "RS", "55": "RS",
  "61": "DF",
  "62": "GO", "64": "GO",
  "63": "TO",
  "65": "MT", "66": "MT",
  "67": "MS",
  "68": "AC",
  "69": "RO",
  "71": "BA", "73": "BA", "74": "BA", "75": "BA", "77": "BA",
  "79": "SE",
  "81": "PE", "87": "PE",
  "82": "AL",
  "83": "PB",
  "84": "RN",
  "85": "CE", "88": "CE",
  "86": "PI", "89": "PI",
  "91": "PA", "93": "PA", "94": "PA",
  "92": "AM", "97": "AM",
  "95": "RR",
  "96": "AP",
  "98": "MA", "99": "MA",
};

const UF_REGIAO: Record<string, RegiaoBrasil> = {
  AC: "norte", AM: "norte", AP: "norte", PA: "norte", RO: "norte", RR: "norte", TO: "norte",
  AL: "nordeste", BA: "nordeste", CE: "nordeste", MA: "nordeste", PB: "nordeste", PE: "nordeste",
  PI: "nordeste", RN: "nordeste", SE: "nordeste",
  DF: "centro-oeste", GO: "centro-oeste", MT: "centro-oeste", MS: "centro-oeste",
  ES: "sudeste", MG: "sudeste", RJ: "sudeste", SP: "sudeste",
  PR: "sul", RS: "sul", SC: "sul",
};

export const REGIAO_LABEL: Record<RegiaoBrasil, string> = {
  norte: "Norte",
  nordeste: "Nordeste",
  "centro-oeste": "Centro-Oeste",
  sudeste: "Sudeste",
  sul: "Sul",
};

/** Cores por macrorregião (badge DDD + destaque) */
export const REGIAO_CORES: Record<
  RegiaoBrasil,
  { bg: string; text: string; border: string; ring: string }
> = {
  norte: { bg: "#0e442922", text: "#2dd4bf", border: "#2dd4bf55", ring: "#2dd4bf33" },
  nordeste: { bg: "#7c2d1222", text: "#fb923c", border: "#fb923c55", ring: "#fb923c33" },
  "centro-oeste": { bg: "#713f1222", text: "#fbbf24", border: "#fbbf2455", ring: "#fbbf2433" },
  sudeste: { bg: "#1e3a8a22", text: "#60a5fa", border: "#60a5fa55", ring: "#60a5fa33" },
  sul: { bg: "#581c8722", text: "#c084fc", border: "#c084fc55", ring: "#c084fc33" },
};

/** Matiz extra por DDD dentro da região (variação visual) */
const DDD_MATIZ: Record<string, number> = {
  "11": 0, "12": 8, "13": 16, "14": 24, "15": 32, "16": 40, "17": 48, "18": 56, "19": 64,
  "21": 0, "22": 20, "24": 40,
  "31": 0, "32": 12, "33": 24, "34": 36, "35": 48, "37": 60, "38": 72,
  "41": 0, "42": 15, "43": 30, "44": 45, "45": 60, "46": 75,
  "47": 0, "48": 25, "49": 50,
  "51": 0, "53": 33, "54": 66,
  "61": 0, "62": 20, "64": 40, "63": 60, "65": 10, "66": 30, "67": 50, "68": 70, "69": 90,
  "71": 0, "73": 18, "74": 36, "75": 54, "77": 72, "79": 90,
  "81": 0, "87": 30, "82": 15, "83": 45, "84": 60, "85": 0, "88": 40, "86": 75, "89": 90,
  "91": 0, "93": 35, "94": 70, "92": 15, "97": 55, "95": 80, "96": 100, "98": 0, "99": 50,
};

function soDigitos(raw: string): string {
  return raw.replace(/\D/g, "");
}

function formatarParteLocal(num: string): string {
  if (num.length === 9) return `${num.slice(0, 5)}-${num.slice(5)}`;
  if (num.length === 8) return `${num.slice(0, 4)}-${num.slice(4)}`;
  if (num.length > 4) return `${num.slice(0, num.length - 4)}-${num.slice(-4)}`;
  return num;
}

export function parseTelefoneBrasil(raw: string | null | undefined): TelefoneBrParsed | null {
  let digits = soDigitos(String(raw ?? ""));
  if (!digits) return null;

  if (digits.startsWith("55") && digits.length >= 12) {
    digits = digits;
  } else if (digits.length >= 10) {
    digits = `55${digits}`;
  } else if (digits.length >= 8) {
    return {
      e164: digits,
      pais: "55",
      ddd: null,
      numero: digits,
      uf: null,
      regiao: null,
    };
  } else {
    return null;
  }

  const nacional = digits.startsWith("55") ? digits.slice(2) : digits;
  if (nacional.length < 10) {
    return {
      e164: digits,
      pais: "55",
      ddd: null,
      numero: nacional,
      uf: null,
      regiao: null,
    };
  }

  const ddd = nacional.slice(0, 2);
  const numero = nacional.slice(2);
  const uf = DDD_UF[ddd] ?? null;
  const regiao = uf ? UF_REGIAO[uf] ?? null : null;

  return {
    e164: `55${nacional}`,
    pais: "55",
    ddd,
    numero,
    uf,
    regiao,
  };
}

export function formatarTelefoneBrasil(
  raw: string | null | undefined,
  opts?: { incluirPais?: boolean }
): string {
  const p = parseTelefoneBrasil(raw);
  if (!p) return "";
  const incluirPais = opts?.incluirPais ?? true;
  const localFmt = formatarParteLocal(p.numero);
  if (!p.ddd) return incluirPais ? `+55 ${localFmt}` : localFmt;
  const base = `(${p.ddd}) ${localFmt}`;
  return incluirPais ? `+55 ${base}` : base;
}

export function telefoneDigitsCopia(raw: string | null | undefined): string {
  const p = parseTelefoneBrasil(raw);
  return p?.e164 ?? soDigitos(String(raw ?? ""));
}

export function coresDdd(ddd: string | null, regiao: RegiaoBrasil | null) {
  if (!ddd || !regiao) {
    return {
      bg: "#21262d",
      text: "#8b949e",
      border: "#30363d",
      ring: "#30363d",
    };
  }
  const base = REGIAO_CORES[regiao];
  const matiz = DDD_MATIZ[ddd] ?? 0;
  if (matiz === 0) return base;
  return {
    ...base,
    bg: base.bg.replace("22", "30"),
    ring: base.ring,
  };
}

export function labelDddTooltip(parsed: TelefoneBrParsed): string {
  if (!parsed.ddd) return "Telefone";
  const uf = parsed.uf ? ` · ${parsed.uf}` : "";
  const reg = parsed.regiao ? ` · ${REGIAO_LABEL[parsed.regiao]}` : "";
  return `DDD ${parsed.ddd}${uf}${reg}`;
}
