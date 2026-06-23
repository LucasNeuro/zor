"use client";

import { PlatformBrandDisplay } from "@/components/brand/PlatformBrandDisplay";
import { usePlatformBrand } from "@/components/brand/PlatformBrandProvider";

export function PlatformBrandLoading() {
  const { brand } = usePlatformBrand();
  const isWhiteLabel = Boolean(brand && !brand.isPrincipal);

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{
        background: isWhiteLabel
          ? `radial-gradient(circle at 20% 10%, color-mix(in srgb, var(--platform-brand-accent) 16%, transparent), transparent 40%), linear-gradient(180deg, #f4faf1 0%, #eef7eb 46%, #f8fcf6 100%)`
          : "radial-gradient(circle at 20% 10%, rgba(146,255,0,0.16), transparent 40%), linear-gradient(180deg, #f4faf1 0%, #eef7eb 46%, #f8fcf6 100%)",
      }}
    >
      <div className="mb-6">
        <PlatformBrandDisplay layout="vertical" tone="brand" wordmarkSize="lg" />
      </div>
      <p className="mb-7 text-sm text-[#527055]">A carregar ambiente...</p>
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-2.5 w-2.5 animate-bounce rounded-full"
            style={{
              background: "var(--platform-brand-primary, #61c900)",
              animationDelay: `${i * 0.12}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
