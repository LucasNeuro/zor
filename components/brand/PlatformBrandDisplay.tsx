"use client";

import { usePlatformBrand } from "@/components/brand/PlatformBrandProvider";
import { PlatformBrandLogo } from "@/components/brand/PlatformBrandLogo";
import { PlatformBrandWordmark } from "@/components/brand/PlatformBrandWordmark";

type Props = {
  className?: string;
  layout?: "vertical" | "horizontal";
  tone?: "bright" | "brand";
  showWordmark?: boolean;
  wordmarkSize?: "sm" | "md" | "lg";
  variant?: "default" | "nav";
  wordmarkClassName?: string;
};

export function PlatformBrandDisplay({
  className = "",
  layout = "vertical",
  tone = "bright",
  showWordmark = true,
  wordmarkSize = "md",
  variant = "default",
  wordmarkClassName = "",
}: Props) {
  const { brand } = usePlatformBrand();
  const isHorizontal = layout === "horizontal";
  const isNav = variant === "nav";
  const isWhiteLabel = Boolean(brand && !brand.isPrincipal);
  const hasCustomLogo = Boolean(brand?.logoUrl || brand?.faviconUrl);

  const logoSlot = hasCustomLogo && isWhiteLabel ? (
    <div
      className={`inline-flex shrink-0 items-center justify-center ${
        isNav ? "h-10 sm:h-12" : isHorizontal ? "h-14" : "mb-3 h-16"
      }`}
    >
      <PlatformBrandLogo
        className={
          isNav
            ? "h-9 w-auto max-w-[120px] sm:max-w-[148px]"
            : "h-12 w-auto max-w-[168px] sm:max-w-[200px]"
        }
      />
    </div>
  ) : (
    <PlatformBrandLogo
      size={isNav ? 44 : isHorizontal ? 48 : 64}
      variant="logo"
      className={isHorizontal ? "" : isNav ? "" : "mb-3"}
    />
  );

  return (
    <div
      className={`flex ${
        isHorizontal ? "flex-row items-center gap-2 sm:gap-3 text-left" : "flex-col items-center text-center"
      } ${className}`}
    >
      {logoSlot}
      {showWordmark ? (
        <div className={isNav ? `min-w-0 ${wordmarkClassName || "hidden sm:block"}` : wordmarkClassName}>
          <PlatformBrandWordmark tone={tone} size={wordmarkSize} />
        </div>
      ) : null}
    </div>
  );
}
