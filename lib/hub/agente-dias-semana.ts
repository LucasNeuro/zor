const DIA_CODIGO_PARA_IDX: Record<string, number> = {
  dom: 0,
  seg: 1,
  ter: 2,
  qua: 3,
  qui: 4,
  sex: 5,
  sab: 6,
};

const DIA_IDX_PARA_CODIGO = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;

const PADRAO_UI = [1, 2, 3, 4, 5];

/** Converte `dias_semana` gravado (códigos ou índices) para índices 0–6 da UI. */
export function diasSemanaParaUi(raw: unknown): number[] {
  if (!Array.isArray(raw) || raw.length === 0) return [...PADRAO_UI];

  const nums: number[] = [];
  for (const item of raw) {
    if (typeof item === "number" && item >= 0 && item <= 6) {
      nums.push(item);
      continue;
    }
    if (typeof item === "string") {
      const k = item.trim().toLowerCase().slice(0, 3);
      const idx = DIA_CODIGO_PARA_IDX[k];
      if (idx !== undefined) nums.push(idx);
    }
  }

  const uniq = [...new Set(nums)].sort((a, b) => a - b);
  return uniq.length > 0 ? uniq : [...PADRAO_UI];
}

/** Formato gravado no hub: códigos `dom`…`sab`. */
export function diasSemanaParaGravacao(indices: number[]): string[] {
  const out = indices
    .filter((i) => i >= 0 && i <= 6)
    .sort((a, b) => a - b)
    .map((i) => DIA_IDX_PARA_CODIGO[i]);

  const uniq = [...new Set(out)];
  return uniq.length > 0 ? uniq : ["seg", "ter", "qua", "qui", "sex"];
}
