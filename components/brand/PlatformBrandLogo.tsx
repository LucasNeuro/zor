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

  // Marca principal (Waje): mascote circular — igual aos avatares dos agentes.
  if (brand?.isPrincipal) {
    return <WajeLogoMark className={className} size={size} />;
  }

  const src =
    variant === "favicon"
      ? brand?.faviconUrl || brand?.logoUrl
      : brand?.logoUrl || brand?.faviconUrl;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={brand?.nome ?? "Logo"}
        className={`object-contain ${size ? "" : className}`}
        style={size ? { width: size, height: size } : undefined}
      />
    );
  }

  return <WajeLogoMark className={className} size={size} />;
}
