import { inferirGeneroPorNome, type GeneroAgenteAvatar } from "@/lib/crm/agente-genero-nome";

const DICEBEAR_BASE = "https://api.dicebear.com/9.x";
const ESTILO_WAJE = "notionists";

/** Fundos menta suaves — alinhado à marca Waje (sem # na query DiceBear). */
const WAJE_BACKGROUNDS = "eef7eb,d1fae5,b8e6cf,f0fdf4";

function fnv1a(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hairVariants(from: number, to: number): string {
  const ids: string[] = [];
  for (let i = from; i <= to; i++) {
    ids.push(`variant${String(i).padStart(2, "0")}`);
  }
  return ids.join(",");
}

/** Parâmetros DiceBear Notionists por género inferido do nome. */
function paramsNotionistsPorGenero(genero: GeneroAgenteAvatar): Record<string, string> {
  const comum = {
    glassesProbability: "20",
    gestureProbability: "32",
  };

  if (genero === "feminino") {
    return {
      ...comum,
      beardProbability: "0",
      hair: hairVariants(34, 63),
    };
  }

  if (genero === "masculino") {
    return {
      ...comum,
      beardProbability: "16",
      hair: hairVariants(1, 33),
    };
  }

  return {
    ...comum,
    beardProbability: "6",
  };
}

/** URL gerada automaticamente (DiceBear ou fallback SVG local) — não usar como foto custom. */
export function isAvatarUrlGeradoAutomaticamente(url: string): boolean {
  const t = url.trim();
  if (!t) return false;
  if (t.startsWith("data:image/svg+xml")) return true;
  return /dicebear\.com/i.test(t);
}

/**
 * Retrato ilustrado Waje (DiceBear Notionists — linha preta minimalista).
 * Género masculino/feminino inferido pelo primeiro nome; seed estável por slug.
 */
export function gerarAvatarAgenteUrl(nome: string, seed?: string): string {
  const genero = inferirGeneroPorNome(nome);
  const seedRaw = (seed || nome).trim() || "agente-waje";
  const params = new URLSearchParams({
    seed: seedRaw,
    backgroundColor: WAJE_BACKGROUNDS,
    backgroundType: "gradientLinear",
    radius: "50",
    ...paramsNotionistsPorGenero(genero),
  });
  return `${DICEBEAR_BASE}/${ESTILO_WAJE}/svg?${params.toString()}`;
}

/** @deprecated Use gerarAvatarAgenteUrl — mantido só como fallback offline. */
export function gerarAvatarAgenteDataUri(seed: string): string {
  const key = seed.trim().toLowerCase() || "agente";
  const h = fnv1a(key);
  const hue = h % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="hsl(${hue},35%,22%)"/><stop offset="100%" stop-color="hsl(${(hue + 40) % 360},55%,45%)"/></linearGradient></defs><rect width="100" height="100" rx="18" fill="url(#g)"/><text x="50" y="58" text-anchor="middle" font-family="system-ui,sans-serif" font-size="36" font-weight="700" fill="#92ff00">${key.slice(0, 1).toUpperCase()}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Retrato canónico do agente — sempre Notionists (slug + nome).
 * Só preserva `avatar_url` quando for foto custom (Storage/CDN), não DiceBear legado.
 */
export function resolverAvatarAgenteUrl(
  seed: string,
  avatarUrl?: string | null,
  nome?: string | null
): string {
  const slug = seed.trim();
  const trim = typeof avatarUrl === "string" ? avatarUrl.trim() : "";
  if (trim.length > 0 && !isAvatarUrlGeradoAutomaticamente(trim)) return trim;
  const displayName = (nome || slug).trim();
  if (displayName.length > 0 && slug.length > 0) return gerarAvatarAgenteUrl(displayName, slug);
  if (displayName.length > 0) return gerarAvatarAgenteUrl(displayName, displayName);
  return gerarAvatarAgenteDataUri(slug || "agente");
}

/** Normaliza `avatar_url` em respostas API / listagens Hub. */
export function normalizarAvatarUrlAgente(
  agenteSlug: string,
  nome?: string | null,
  avatarUrl?: string | null
): string {
  return resolverAvatarAgenteUrl(agenteSlug, avatarUrl, nome);
}

/** Carga visual 0–1 para barra de progresso nos cards (determinística). */
export function cargaOperacionalVisual(seed: string, ativo: boolean): number {
  if (!ativo) return 0.08;
  const h = fnv1a(seed);
  return 0.42 + ((h % 47) / 100);
}
