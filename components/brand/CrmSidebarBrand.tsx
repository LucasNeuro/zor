"use client";

import Link from "next/link";
import { PlatformBrandLogo } from "@/components/brand/PlatformBrandLogo";
import { PlatformBrandWordmark } from "@/components/brand/PlatformBrandWordmark";
import { usePlatformBrand } from "@/components/brand/PlatformBrandProvider";

type Props = {
  expanded: boolean;
};

export function CrmSidebarBrand({ expanded }: Props) {
  const { brand } = usePlatformBrand();
  const isWhiteLabel = Boolean(brand && !brand.isPrincipal);
  const hasCustomLogo = Boolean(brand?.logoUrl || brand?.faviconUrl);

  return (
    <Link
      href="/crm"
      className="flex items-center gap-2.5 no-underline"
      style={{ justifyContent: expanded ? "flex-start" : "center", width: "100%" }}
    >
      {isWhiteLabel && hasCustomLogo ? (
        <div className="flex h-9 max-w-[140px] flex-shrink-0 items-center">
          <PlatformBrandLogo className="h-8 w-auto max-w-[132px]" />
        </div>
      ) : (
        <PlatformBrandLogo size={expanded ? 44 : 40} variant="logo" />
      )}
      {expanded ? <PlatformBrandWordmark size="sm" tone="brand" /> : null}
    </Link>
  );
}
