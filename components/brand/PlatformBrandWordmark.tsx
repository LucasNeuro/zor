"use client";

import { WajeWordmark } from "@/components/brand/WajeWordmark";
import { usePlatformBrand } from "@/components/brand/PlatformBrandProvider";

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

export function PlatformBrandWordmark({ className = "", size = "md", tone = "brand" }: Props) {
  const { brand } = usePlatformBrand();

  if (!brand || brand.isPrincipal) {
    return <WajeWordmark className={className} size={size} tone={tone} />;
  }

  const baseColor = tone === "brand" ? "#0b2210" : "#f8fcf6";
  const accent = brand.corAccent || "#4fc3f7";

  return (
    <span
      className={`inline-flex items-baseline font-extrabold leading-none tracking-tight ${sizes[size]} ${className}`}
      aria-label={brand.nome}
      style={{ color: baseColor }}
    >
      <span style={{ color: accent }}>{brand.nome}</span>
    </span>
  );
}
