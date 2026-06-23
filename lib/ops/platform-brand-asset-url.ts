import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformBrand } from "@/lib/platform-brands";
import { PLATFORM_BRANDS_BUCKET } from "@/lib/ops/platform-brand-logo-upload";

export function isUsableAssetUrl(url: string | null | undefined): boolean {
  const u = url?.trim();
  if (!u) return false;
  return u.startsWith("http://") || u.startsWith("https://");
}

export function storagePublicUrl(objectPath: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return null;
  const path = objectPath.replace(/^\/+/, "");
  return `${base}/storage/v1/object/public/${PLATFORM_BRANDS_BUCKET}/${path}`;
}

export async function resolveBrandAssetFromStorage(
  supabase: SupabaseClient,
  slug: string,
  kind: "logo" | "favicon" | "logo_dark"
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(PLATFORM_BRANDS_BUCKET).list(slug, { limit: 30 });
  if (error || !data?.length) return null;
  const prefix = `${kind}.`;
  const hit = data.find((f) => f.name && f.name.startsWith(prefix) && !f.name.endsWith("/"));
  if (!hit?.name) return null;
  const { data: pub } = supabase.storage.from(PLATFORM_BRANDS_BUCKET).getPublicUrl(`${slug}/${hit.name}`);
  return pub.publicUrl || null;
}

type AssetFields = {
  logo_url?: string | null;
  favicon_url?: string | null;
  logo_dark_url?: string | null;
};

export async function resolvePlatformBrandAssetUrls<T extends AssetFields>(
  supabase: SupabaseClient,
  slug: string,
  row: T
): Promise<T> {
  const out = { ...row };
  const pairs: Array<["logo" | "favicon" | "logo_dark", keyof AssetFields]> = [
    ["logo", "logo_url"],
    ["favicon", "favicon_url"],
    ["logo_dark", "logo_dark_url"],
  ];
  for (const [kind, key] of pairs) {
    const current = out[key];
    if (!isUsableAssetUrl(typeof current === "string" ? current : null)) {
      const fromStorage = await resolveBrandAssetFromStorage(supabase, slug, kind);
      if (fromStorage) (out as AssetFields)[key] = fromStorage;
    }
  }
  return out;
}

export async function enrichPlatformBrandAssets(
  supabase: SupabaseClient,
  brand: PlatformBrand
): Promise<PlatformBrand> {
  const urls = await resolvePlatformBrandAssetUrls(supabase, brand.slug, {
    logo_url: brand.logoUrl,
    favicon_url: brand.faviconUrl,
    logo_dark_url: brand.logoDarkUrl,
  });
  return {
    ...brand,
    logoUrl: urls.logo_url ?? brand.logoUrl,
    faviconUrl: urls.favicon_url ?? brand.faviconUrl,
    logoDarkUrl: urls.logo_dark_url ?? brand.logoDarkUrl,
  };
}

export async function enrichPlatformBrandRowAssets<T extends AssetFields & { slug: string; id?: string }>(
  supabase: SupabaseClient,
  row: T
): Promise<T> {
  const enriched = await resolvePlatformBrandAssetUrls(supabase, row.slug, row);
  const patch: Partial<AssetFields> = {};
  if (enriched.logo_url && enriched.logo_url !== row.logo_url) patch.logo_url = enriched.logo_url;
  if (enriched.favicon_url && enriched.favicon_url !== row.favicon_url) {
    patch.favicon_url = enriched.favicon_url;
  }
  if (enriched.logo_dark_url && enriched.logo_dark_url !== row.logo_dark_url) {
    patch.logo_dark_url = enriched.logo_dark_url;
  }
  if (row.id && Object.keys(patch).length > 0) {
    await supabase
      .from("hub_platform_brands")
      .update({ ...patch, atualizado_em: new Date().toISOString() })
      .eq("id", row.id);
  }
  return { ...row, ...enriched };
}
