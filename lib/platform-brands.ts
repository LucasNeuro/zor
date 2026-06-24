import type { NextRequest } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { enrichPlatformBrandAssets } from "@/lib/ops/platform-brand-asset-url";
import {
  APP_NAME_TITLE,
  BRAND_GREEN,
  BRAND_GREEN_BRIGHT,
  BRAND_MARK_BG,
  COMPANY_NAME,
} from "@/lib/brand";

export type PlatformBrand = {
  id?: string;
  slug: string;
  nome: string;
  tagline?: string | null;
  dominios: string[];
  logoUrl?: string | null;
  logoDarkUrl?: string | null;
  faviconUrl?: string | null;
  corPrimaria: string;
  corAccent: string;
  corFundo: string;
  companyName?: string | null;
  isPrincipal: boolean;
  landingAssistantAtivo?: boolean;
};

export type PlatformBrandPublic = Pick<
  PlatformBrand,
  | "slug"
  | "nome"
  | "tagline"
  | "logoUrl"
  | "logoDarkUrl"
  | "faviconUrl"
  | "corPrimaria"
  | "corAccent"
  | "corFundo"
  | "companyName"
  | "isPrincipal"
  | "landingAssistantAtivo"
>;

const WAJE_STATIC: PlatformBrand = {
  slug: "waje",
  nome: APP_NAME_TITLE,
  tagline: "IA para atendimento e CRM",
  dominios: ["waje.com.br", "www.waje.com.br", "localhost:3001", "localhost:3000", "127.0.0.1:3001"],
  faviconUrl: "/favicons/favicon-192x192.png",
  corPrimaria: BRAND_GREEN,
  corAccent: BRAND_GREEN_BRIGHT,
  corFundo: BRAND_MARK_BG,
  companyName: COMPANY_NAME,
  isPrincipal: true,
};

const SYNKRON_STATIC: PlatformBrand = {
  slug: "synkron",
  nome: "Synkron.IA",
  tagline: "Inteligência sincronizada",
  dominios: [
    "synkronia.com.br",
    "www.synkronia.com.br",
    "synkronia.lvh.me",
    "synkronia.lvh.me:3001",
    "synkronia.local",
    "synkronia.local:3001",
  ],
  logoUrl: "/brands/synkron/logo.png",
  faviconUrl: "/brands/synkron/logo.png",
  corPrimaria: "#3f9848",
  corAccent: "#4fc3f7",
  corFundo: "#000000",
  companyName: "Synkron.IA",
  isPrincipal: false,
};

const STATIC_BRANDS: PlatformBrand[] = [WAJE_STATIC, SYNKRON_STATIC];

let cacheAt = 0;
type CachedBrand = PlatformBrand & { ativo: boolean };
let cacheBrands: CachedBrand[] | null = null;
const CACHE_MS = 60_000;

/** Domínios extras só em `npm run dev` — testar Synkron sem editar hosts (lvh.me → 127.0.0.1). */
const DEV_SYNKRON_EXTRA_DOMAINS = [
  "synkronia.lvh.me",
  "synkronia.lvh.me:3001",
  "synkronia.local",
  "synkronia.local:3001",
] as const;

function mergeDevSynkronDomains(brand: PlatformBrand): PlatformBrand {
  if (process.env.NODE_ENV !== "development" || brand.slug !== "synkron") return brand;
  return {
    ...brand,
    dominios: [...new Set([...brand.dominios, ...DEV_SYNKRON_EXTRA_DOMAINS])],
  };
}

export function normalizeHostname(host: string): string {
  return host.split(",")[0]?.trim().toLowerCase() ?? "";
}

function hostMatchesDomain(host: string, domain: string): boolean {
  const h = normalizeHostname(host);
  const d = domain.trim().toLowerCase();
  if (!h || !d) return false;
  if (h === d) return true;
  if (d.includes(":")) return h === d;
  const hostOnly = h.split(":")[0] ?? h;
  return hostOnly === d;
}

function rowToBrand(row: Record<string, unknown>): PlatformBrand {
  return {
    id: typeof row.id === "string" ? row.id : undefined,
    slug: String(row.slug ?? "waje"),
    nome: String(row.nome ?? APP_NAME_TITLE),
    tagline: typeof row.tagline === "string" ? row.tagline : null,
    dominios: Array.isArray(row.dominios) ? row.dominios.map(String) : [],
    logoUrl: typeof row.logo_url === "string" ? row.logo_url : null,
    logoDarkUrl: typeof row.logo_dark_url === "string" ? row.logo_dark_url : null,
    faviconUrl: typeof row.favicon_url === "string" ? row.favicon_url : null,
    corPrimaria: String(row.cor_primaria ?? BRAND_GREEN),
    corAccent: String(row.cor_accent ?? BRAND_GREEN_BRIGHT),
    corFundo: String(row.cor_fundo ?? BRAND_MARK_BG),
    companyName: typeof row.company_name === "string" ? row.company_name : null,
    isPrincipal: row.is_principal === true,
    landingAssistantAtivo: row.landing_assistant_ativo !== false,
  };
}

export function toPlatformBrandPublic(brand: PlatformBrand): PlatformBrandPublic {
  return {
    slug: brand.slug,
    nome: brand.nome,
    tagline: brand.tagline,
    logoUrl: brand.logoUrl,
    logoDarkUrl: brand.logoDarkUrl,
    faviconUrl: brand.faviconUrl,
    corPrimaria: brand.corPrimaria,
    corAccent: brand.corAccent,
    corFundo: brand.corFundo,
    companyName: brand.companyName,
    isPrincipal: brand.isPrincipal,
    landingAssistantAtivo: brand.landingAssistantAtivo !== false,
  };
}

export function resolveStaticPlatformBrand(host: string): PlatformBrand {
  const norm = normalizeHostname(host);
  for (const brand of STATIC_BRANDS) {
    const candidate = mergeDevSynkronDomains(brand);
    if (candidate.dominios.some((d) => hostMatchesDomain(norm, d))) return candidate;
  }
  const fallbackSlug = process.env.PLATFORM_BRAND_FALLBACK_SLUG?.trim() || "waje";
  return STATIC_BRANDS.find((b) => b.slug === fallbackSlug) ?? WAJE_STATIC;
}

async function loadAllBrandsFromDb(): Promise<CachedBrand[] | null> {
  const now = Date.now();
  if (cacheBrands && now - cacheAt < CACHE_MS) return cacheBrands;
  try {
    const { data, error } = await crmDb().from("hub_platform_brands").select("*");
    if (error || !data?.length) return null;
    cacheBrands = data.map((row) => ({
      ...rowToBrand(row as Record<string, unknown>),
      ativo: (row as { ativo?: boolean }).ativo !== false,
    }));
    cacheAt = now;
    return cacheBrands;
  } catch {
    return null;
  }
}

function principalBrand(brands: CachedBrand[]): PlatformBrand {
  return brands.find((b) => b.isPrincipal && b.ativo) ?? WAJE_STATIC;
}

export function clearPlatformBrandCache(): void {
  cacheBrands = null;
  cacheAt = 0;
}

export async function resolvePlatformBrand(host: string): Promise<PlatformBrand> {
  const norm = normalizeHostname(host);
  const fromDb = await loadAllBrandsFromDb();
  if (fromDb?.length) {
    const match = fromDb.find((b) => {
      const candidate = mergeDevSynkronDomains(b);
      return candidate.dominios.some((d) => hostMatchesDomain(norm, d));
    });
    if (match) {
      if (!match.ativo) return enrichPlatformBrandAssets(crmDb(), principalBrand(fromDb));
      const { ativo: _ativo, ...brand } = match;
      return enrichPlatformBrandAssets(crmDb(), brand);
    }
    return enrichPlatformBrandAssets(crmDb(), principalBrand(fromDb));
  }
  return enrichPlatformBrandAssets(crmDb(), resolveStaticPlatformBrand(norm));
}

export function hostFromRequest(request: NextRequest | { headers: Headers }): string {
  return hostFromHeaders(request.headers);
}

export function hostFromHeaders(headers: Headers): string {
  return (
    headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    headers.get("host")?.trim() ||
    ""
  );
}

export async function resolvePlatformBrandFromRequest(
  request: NextRequest | { headers: Headers }
): Promise<PlatformBrand> {
  return resolvePlatformBrand(hostFromHeaders(request.headers));
}
