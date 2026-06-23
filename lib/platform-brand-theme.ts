import type { PlatformBrandPublic } from "@/lib/platform-brands";
import { BRAND_GREEN, BRAND_GREEN_BRIGHT, BRAND_MARK_BG } from "@/lib/brand";

export function platformBrandCssVars(brand: PlatformBrandPublic): Record<string, string> {
  return {
    "--platform-brand-primary": brand.corPrimaria || BRAND_GREEN,
    "--platform-brand-accent": brand.corAccent || BRAND_GREEN_BRIGHT,
    "--platform-brand-bg": brand.corFundo || BRAND_MARK_BG,
  };
}

export function platformBrandHtmlAttrs(brand: PlatformBrandPublic): Record<string, string> {
  return {
    "data-brand-slug": brand.slug,
    "data-white-label": brand.isPrincipal ? "0" : "1",
  };
}

export function platformBrandCssText(brand: PlatformBrandPublic): string {
  const vars = platformBrandCssVars(brand);
  return `:root{${Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";")}}`;
}
