"use client";

import { BRAND_MARK_BG } from "@/lib/brand";
import { usePlatformBrand } from "@/components/brand/PlatformBrandProvider";
import { PlatformBrandLogo } from "@/components/brand/PlatformBrandLogo";
import { PlatformBrandWordmark } from "@/components/brand/PlatformBrandWordmark";

type Props = {
  className?: string;
  layout?: "vertical" | "horizontal";
  tone?: "bright" | "brand";
  showWordmark?: boolean;
  wordmarkSize?: "sm" | "md" | "lg";
};

export function PlatformBrandDisplay({
  className = "",
  layout = "vertical",
  tone = "bright",
  showWordmark = true,
  wordmarkSize = "md",
}: Props) {
  const { brand } = usePlatformBrand();
  const isHorizontal = layout === "horizontal";
  const markBg = brand?.corFundo && !brand.isPrincipal ? brand.corFundo : BRAND_MARK_BG;

  return (
    <div
      className={`flex ${
        isHorizontal ? "flex-row items-center gap-3 text-left" : "flex-col items-center text-center"
      } ${className}`}
    >
      <div
        className={`inline-flex items-center justify-center rounded-2xl border border-[#92ff00]/40 shadow-[0_0_30px_rgba(146,255,0,0.20)] ${
          isHorizontal ? "h-12 w-12" : "mb-3 h-16 w-16"
        }`}
        style={{ background: markBg }}
      >
        <PlatformBrandLogo className="h-9 w-9" />
      </div>
      {showWordmark ? (
        <PlatformBrandWordmark tone={tone} size={wordmarkSize} />
      ) : null}
    </div>
  );
}
