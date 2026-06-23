"use client";

import { WajeWordmark } from "@/components/brand/WajeWordmark";
import { usePlatformBrand } from "@/components/brand/PlatformBrandProvider";
import { BRAND_GREEN_BRIGHT, BRAND_TEXT_DARK } from "@/lib/brand";

type Props = {
  className?: string;
  size?: "sm" | "md" | "lg";
  tone?: "bright" | "brand";
};

const sizes = {
  sm: "text-[22px]",
  md: "text-[30px]",
  lg: "text-[36px]",
};

const FIRST_CHAR_GRADIENT = { angle: 112, stop: "32%" };

export function PlatformBrandWordmark({ className = "", size = "md", tone = "brand" }: Props) {
  const { brand } = usePlatformBrand();

  if (!brand || brand.isPrincipal) {
    return <WajeWordmark className={className} size={size} tone={tone} />;
  }

  const baseColor = tone === "brand" ? BRAND_TEXT_DARK : "#f8fcf6";
  const accent = BRAND_GREEN_BRIGHT;
  const { angle, stop } = FIRST_CHAR_GRADIENT;
  const firstFill = `linear-gradient(${angle}deg, ${accent} 0%, ${accent} ${stop}, ${baseColor} ${stop}, ${baseColor} 100%)`;
  const first = brand.nome.charAt(0);
  const rest = brand.nome.slice(1);

  return (
    <span
      className={`inline-flex items-baseline font-extrabold leading-none tracking-tight ${sizes[size]} ${className}`}
      aria-label={brand.nome}
    >
      <span
        className="inline-block"
        style={{
          backgroundImage: firstFill,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
          color: "transparent",
        }}
      >
        {first}
      </span>
      <span style={{ color: baseColor }}>{rest}</span>
    </span>
  );
}
