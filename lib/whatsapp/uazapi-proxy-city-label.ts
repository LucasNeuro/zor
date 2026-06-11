/** Formata slug UAZAPI (`sao_lourenco_da_mata`) para exibição legível. */
export function formatProxyCityLabel(slug: string): string {
  const s = slug.trim();
  if (!s) return "";
  return s
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatProxyCityDisplay(label: string, state?: string | null): string {
  const base = label.trim() || "";
  const uf = state?.trim().toUpperCase();
  if (!base) return uf ? `(${uf})` : "";
  return uf ? `${base} (${uf})` : base;
}

/** Remove acentos e normaliza para comparação de busca. */
export function normalizeCitySearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Termo enviado à API UAZAPI (`search=` — parcial, sem acento). */
export function buildProxyCityApiSearch(query: string): string {
  const norm = normalizeCitySearchText(query);
  if (!norm) return "";
  const compact = norm.replace(/\s+/g, "");
  if (compact.length >= 3) return compact;
  return norm;
}

export type ProxyCitySearchRow = {
  value: string;
  label: string;
  state?: string;
};

/** Filtro local — garante que a lista reflecte o que o utilizador digitou. */
export function filterProxyCitiesByQuery<T extends ProxyCitySearchRow>(
  cities: T[],
  query: string
): T[] {
  const q = normalizeCitySearchText(query);
  if (!q || q.length < 2) return cities;

  const tokens = q.split(" ").filter((t) => t.length >= 2);
  const needleCompact = q.replace(/\s+/g, "");

  return cities.filter((c) => {
    const label = normalizeCitySearchText(c.label);
    const slugText = normalizeCitySearchText(c.value.replace(/_/g, " "));
    const slugCompact = slugText.replace(/\s+/g, "");
    const haystacks = [label, slugText, slugCompact];

    if (needleCompact.length >= 2) {
      if (haystacks.some((h) => h.includes(needleCompact) || h.replace(/\s+/g, "").includes(needleCompact))) {
        return true;
      }
    }

    if (tokens.length === 0) {
      return haystacks.some((h) => h.includes(q));
    }

    return tokens.every(
      (token) =>
        haystacks.some((h) => h.includes(token)) ||
        slugCompact.includes(token.replace(/\s+/g, ""))
    );
  });
}
