import type { SupabaseClient } from "@supabase/supabase-js";

export const PLATFORM_BRANDS_BUCKET = "platform-brands";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/x-icon"]);

function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/svg+xml") return "svg";
  if (mime === "image/x-icon") return "ico";
  return "png";
}

export type PlatformBrandAssetKind = "logo" | "logo_dark" | "favicon";

export async function uploadPlatformBrandAsset(
  supabase: SupabaseClient,
  slug: string,
  kind: PlatformBrandAssetKind,
  file: File
): Promise<{ ok: true; publicUrl: string; storagePath: string } | { ok: false; error: string }> {
  const mime = (file.type || "image/png").toLowerCase();
  if (!ALLOWED.has(mime) && !file.name.match(/\.(png|jpe?g|webp|svg|ico)$/i)) {
    return { ok: false, error: "Formato inválido. Use PNG, JPG, WEBP ou SVG." };
  }
  if (file.size > 4 * 1024 * 1024) {
    return { ok: false, error: "Arquivo muito grande (máx. 4 MB)." };
  }

  const ext = extFromMime(mime);
  const storagePath = `${slug.trim()}/${kind}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const upload = await supabase.storage.from(PLATFORM_BRANDS_BUCKET).upload(storagePath, bytes, {
    upsert: true,
    contentType: mime,
    cacheControl: "3600",
  });

  if (upload.error) {
    return {
      ok: false,
      error: `Upload falhou (${upload.error.message}). Crie o bucket público «${PLATFORM_BRANDS_BUCKET}» no Supabase Storage.`,
    };
  }

  const { data: pub } = supabase.storage.from(PLATFORM_BRANDS_BUCKET).getPublicUrl(storagePath);
  return { ok: true, publicUrl: pub.publicUrl, storagePath };
}
