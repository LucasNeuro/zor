"use client";

import { WajeLogoMark } from "@/components/brand/WajeLogoMark";
import { usePlatformBrand } from "@/components/brand/PlatformBrandProvider";

type Props = {
  className?: string;
  size?: number;
  /** logo = marca principal; favicon = ícone pequeno */
  variant?: "logo" | "favicon";
};

export function PlatformBrandLogo({ className = "h-9 w-9", size, variant = "logo" }: Props) {
  const { brand } = usePlatformBrand();
  const src =
    variant === "favicon"
      ? brand?.faviconUrl || brand?.logoUrl
      : brand?.logoUrl || brand?.faviconUrl;

  if (src) {
    const dim = size ? { width: size, height: size } : undefined;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={brand?.nome ?? "Logo"}
        className={size ? "object-contain" : `${className} object-contain`}
        style={dim}
      />
    );
  }

  return <WajeLogoMark className={className} size={size} />;
}
