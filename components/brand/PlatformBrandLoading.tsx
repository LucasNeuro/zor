"use client";

import { PlatformBrandDisplay } from "@/components/brand/PlatformBrandDisplay";
import { usePlatformBrand } from "@/components/brand/PlatformBrandProvider";
import { CrmSideoverSpinner } from "@/components/crm/CrmSideoverLoadingState";

type Props = {
  label?: string;
  /** Tema claro (CRM/login) ou escuro (sideovers). */
  theme?: "light" | "dark";
};

/** Ecrã completo de bootstrap — marca + spinner até dados prontos. */
export function PlatformBrandLoading({ label = "A carregar ambiente…", theme = "light" }: Props) {
  const { brand } = usePlatformBrand();
  const isWhiteLabel = Boolean(brand && !brand.isPrincipal);

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{
        background:
          theme === "dark"
            ? "radial-gradient(circle at 20% 10%, rgba(146,255,0,0.08), transparent 42%), #0b1f10"
            : isWhiteLabel
              ? `radial-gradient(circle at 20% 10%, color-mix(in srgb, var(--platform-brand-accent) 16%, transparent), transparent 40%), linear-gradient(180deg, #f4faf1 0%, #eef7eb 46%, #f8fcf6 100%)`
              : "radial-gradient(circle at 20% 10%, rgba(146,255,0,0.16), transparent 40%), linear-gradient(180deg, #f4faf1 0%, #eef7eb 46%, #f8fcf6 100%)",
      }}
    >
      <div className="mb-6">
        <PlatformBrandDisplay layout="vertical" tone="brand" wordmarkSize="lg" />
      </div>
      <div className="flex items-center gap-3">
        <CrmSideoverSpinner size={22} theme={theme === "dark" ? "dark" : "light"} />
        <p
          className="text-sm font-semibold"
          style={{ color: theme === "dark" ? "#9ca89e" : "#527055" }}
        >
          {label}
        </p>
      </div>
    </div>
  );
}
